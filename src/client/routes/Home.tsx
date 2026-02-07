import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

import { client } from '@/client/lib/api-client';
import { authClient } from '@/client/lib/auth-client';
import { renderAnalysisBase, cropElement } from '@/client/services/pdfService';
import { assemblePptx } from '@/client/services/pptxService';
import { AppStatus, ExtractionMode, SlideConfig, SlideStructure, ImagePart } from '@/types';

import { Button } from "@/client/components/ui/button";
import { Link } from 'react-router-dom';
import { Info, Check, X, ArrowRight, Settings, FileText, Image as ImageIcon, Layout, Maximize } from 'lucide-react';

// Vite環境でのWorker設定
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_PAGES = 100; 

const MODE_DETAILS: Record<ExtractionMode, { label: string; desc: string; longDesc: string; icon: any }> = {
  [ExtractionMode.BALANCED]: { 
    label: "標準 (推奨)", 
    desc: "図形・パーツ・文字", 
    longDesc: "文字と図形のバランスが良いモードです。編集可能なテキストと、再現が難しい図解（画像切り抜き）を自動で使い分けます。",
    icon: Layout
  },
  [ExtractionMode.TEXT_FOCUS]: {
    label: "文字重視", 
    desc: "テキスト抽出のみ", 
    longDesc: "テキストの編集性を最優先します。装飾や複雑な背景は無視され、シンプルな箇条書きやタイトル構成に変換されます。",
    icon: FileText
  },
  [ExtractionMode.COMPONENTS]: {
    label: "パーツ分離", 
    desc: "図解・UI・素材", 
    longDesc: "グラフや図解を積極的に画像として切り抜きます。デザイン崩れを防ぎたい資料や、ビジュアル重視のスライド向けです。",
    icon: ImageIcon
  },
  [ExtractionMode.FULL_IMAGE]: { 
    label: "画像のみ", 
    desc: "AIなし・一枚絵", 
    longDesc: "スライド全体を1枚の画像として貼り付けます。編集はできませんが、見た目は100%再現されます。AIを使わないため高速です。",
    icon: Maximize
  },
};

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [hasKey, setHasKey] = useState(false);

  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [slides, setSlides] = useState<SlideConfig[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [showModeInfo, setShowModeInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSelected = slides.length > 0 && slides.every(s => s.enabled);
  const selectedCount = slides.filter(s => s.enabled).length;

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await authClient.getSession();
      setSession(data);
      if (data) {
        try {
            const res = await client.api.settings.$get();
            if (res.ok) {
                const json = await res.json();
                setHasKey(json.hasKey);
            }
        } catch (e) {
            console.error(e);
        }
      }
      setIsAuthChecking(false);
    };
    checkAuth();
  }, []);

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.origin
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus(AppStatus.DECOMPOSING);
      setProgress(5);
      setMessage('PDFを読み込んでいます...');
      setFileName(file.name);
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = Math.min(pdf.numPages, MAX_PAGES); 
      
      const newSlides: SlideConfig[] = [];
      
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const previewUrl = await renderAnalysisBase(page);
        newSlides.push({
          pageNumber: i,
          previewUrl,
          mode: ExtractionMode.BALANCED,
          enabled: true 
        });
        setProgress(Math.round((i / totalPages) * 100));
        setMessage(`プレビュー作成中 (${i}/${totalPages})`);
      }

      setSlides(newSlides);
      setStatus(AppStatus.PREVIEWING);
      setProgress(0);
      setMessage('変換設定を選択してください');

    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setError(err.message || '読み込みエラー');
    }
  };

  const toggleSelectAll = (select: boolean) => {
    setSlides(prev => prev.map(s => ({ ...s, enabled: select })));
  };

  const bulkUpdateMode = (mode: ExtractionMode) => {
    setSlides(prev => prev.map(s => s.enabled ? { ...s, mode } : s));
  };

  const callApiWithRetry = async (slide: SlideConfig, retries = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await client.api.analyze.$post({
                json: { image: slide.previewUrl, mode: slide.mode }
            });

            if (!res.ok) {
                if (res.status === 429) {
                    const retryAfterHeader = res.headers.get('Retry-After');
                    const waitTime = retryAfterHeader ? parseInt(retryAfterHeader) * 1000 : 20000;
                    console.warn(`Rate limit hit. Waiting ${waitTime}ms...`);
                    setMessage(`混雑中... ${Math.ceil(waitTime/1000)}秒待機して再試行します`);
                    await new Promise(r => setTimeout(r, waitTime));
                    continue;
                }
                if (res.status === 503) {
                    console.warn(`Server overloaded. Waiting 5s...`);
                    setMessage(`サーバー混雑中... 5秒待機します`);
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }
                throw new Error(`API Error: ${res.statusText}`);
            }
            return await res.json();
        } catch (e: any) {
            if (i === retries - 1) throw e;
        }
    }
  };

  const startFinalConversion = async () => {
    const selectedSlides = slides.filter(s => s.enabled);
    if (selectedSlides.length === 0) return;

    try {
      setStatus(AppStatus.ASSEMBLING);
      setProgress(0);
      
      const results: SlideStructure[] = [];

      for (let i = 0; i < selectedSlides.length; i++) {
        const slide = selectedSlides[i];
        
        if (slide.mode === ExtractionMode.FULL_IMAGE) {
            setMessage(`画像処理中: ${i + 1} / ${selectedSlides.length}枚目`);
            // @ts-ignore
            const fullImage = await cropElement(slide.previewUrl, [0, 0, 1000, 1000]);
            if (fullImage) {
                results.push({
                    backgroundColor: "#FFFFFF",
                    elements: { shapes: [], text: [], images: [{ type: 'photo', data: fullImage, x: 0, y: 0, w: 13.33, h: 7.5, order: 1 }] }
                });
            }
            setProgress(Math.round(((i + 1) / selectedSlides.length) * 100));
            continue; 
        }

        setMessage(`AI解析中: ${i + 1} / ${selectedSlides.length}枚目`);
        
        try {
            const json = await callApiWithRetry(slide);

            const imageParts: ImagePart[] = [];
            if (json.rawImageInstructions) {
                for (const instruction of json.rawImageInstructions) {
                    // @ts-ignore
                    const cropped = await cropElement(slide.previewUrl, instruction.box);
                    if (cropped) {
                        imageParts.push({
                            type: 'photo',
                            data: cropped,
                            // ここでPPTX用のインチ座標に変換
                            x: (instruction.box[1] / 1000) * 13.33,
                            y: (instruction.box[0] / 1000) * 7.5,
                            w: ((instruction.box[3] - instruction.box[1]) / 1000) * 13.33,
                            h: ((instruction.box[2] - instruction.box[0]) / 1000) * 7.5,
                            order: instruction.order || 20
                        });
                    }
                }
            }
            
            results.push({
                backgroundColor: json.backgroundColor || "#FFFFFF",
                elements: {
                    shapes: (json.elements?.shapes || []) as any,
                    text: (json.elements?.text || []) as any,
                    images: imageParts
                }
            });

        } catch (e: any) {
            console.error(`Slide ${i+1} failed:`, e);
            results.push({ backgroundColor: "#FFFFFF", elements: { shapes: [], text: [], images: [] } });
        }
        
        setProgress(Math.round(((i + 1) / selectedSlides.length) * 100));
        if (i < selectedSlides.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
      }

      setMessage('PowerPointファイルを構築中...');
      await assemblePptx(results, fileName.replace('.pdf', ''));
      setStatus(AppStatus.COMPLETED);

    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setError('変換エラー: ' + (err.message || '不明なエラー'));
    }
  };
  
  const reset = () => {
    setStatus(AppStatus.IDLE);
    setSlides([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateMode = (pageNum: number, mode: ExtractionMode) => {
    setSlides(prev => prev.map(s => s.pageNumber === pageNum ? { ...s, mode } : s));
  };


  if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="max-w-2xl space-y-8 animate-in fade-in zoom-in duration-700">
          <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight">PDF <span className="text-indigo-600">to</span> PPTX</h1>
          <Button onClick={handleSignIn} size="lg" className="text-lg px-8 py-6 rounded-2xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xl">Googleで始める</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-4">
            <Link to="/settings" className="hover:opacity-70 transition-opacity">
                <Button variant="outline" size="icon" className="bg-white border-slate-200">
                    <Settings size={20} className="text-slate-600" />
                </Button>
            </Link>
            <h1 className="text-xl font-bold text-slate-800">PDF <span className="text-indigo-600">→</span> PPTX</h1>
           </div>
           <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm">
            {session.user.image && <img src={session.user.image} className="w-6 h-6 rounded-full" />}
            <span className="text-xs font-bold text-slate-600">{session.user.name}</span>
            </div>
        </header>

        {status === AppStatus.IDLE && (
          <div className="bg-white p-20 rounded-3xl shadow-xl border border-slate-100 text-center animate-in zoom-in duration-300">
             {!hasKey ? (
                <div className="space-y-6">
                    <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto text-2xl">🔑</div>
                    <h3 className="text-xl font-bold text-slate-800">APIキーの設定が必要です</h3>
                    <Link to="/settings"><Button className="bg-indigo-600 hover:bg-indigo-700 px-8 py-6 text-lg rounded-xl shadow-lg">設定画面へ移動する</Button></Link>
                </div>
             ) : (
                <>
                    <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileUpload} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="cursor-pointer inline-block bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg hover:scale-105">PDFを選択してアップロード</label>
                    <p className="mt-6 text-slate-400 font-medium text-sm">※ 最大{MAX_PAGES}ページまで対応</p>
                </>
             )}
          </div>
        )}

        {(status === AppStatus.DECOMPOSING || status === AppStatus.ASSEMBLING) && (
            <div className="fixed inset-0 bg-white/90 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xl text-slate-700 font-bold animate-pulse">{message}</p>
                <p className="text-sm text-slate-400 mt-2">{progress}% 完了</p>
            </div>
        )}

        {status === AppStatus.PREVIEWING && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 sticky top-4 z-20 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-800">抽出設定</h2>
                                <button 
                                    onClick={() => setShowModeInfo(true)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition"
                                >
                                    <Info size={14} /> モード説明
                                </button>
                            </div>
                            <p className="text-sm text-slate-500">各スライドの変換モードを選択してください</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-md">
                                選択中: {selectedCount}枚
                            </span>
                            <Button variant="ghost" onClick={reset}>キャンセル</Button>
                            <Button onClick={startFinalConversion} disabled={selectedCount === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all hover:shadow-lg flex items-center gap-2">
                                PowerPointを作成 <ArrowRight size={18} />
                            </Button>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Button variant={allSelected ? "default" : "outline"} size="sm" onClick={() => toggleSelectAll(true)} className={`gap-1 ${allSelected ? 'bg-slate-800 hover:bg-slate-900 text-white border-transparent' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}>
                                <Check size={16} /> すべて選択
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => toggleSelectAll(false)} className="gap-1 bg-white text-slate-700 border-slate-300 hover:bg-slate-100">
                                <X size={16} /> 全解除
                            </Button>
                        </div>
                        
                        <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-500">一括設定:</span>
                            {Object.values(ExtractionMode).map(m => (
                                <button 
                                    key={m}
                                    onClick={() => bulkUpdateMode(m)}
                                    disabled={selectedCount === 0}
                                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-50 disabled:pointer-events-none transition"
                                >
                                    {MODE_DETAILS[m].label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {slides.map(slide => (
                        <div 
                            key={slide.pageNumber} 
                            className={`relative bg-white rounded-2xl overflow-hidden border-2 transition-all duration-200 group shadow-sm hover:shadow-md ${slide.enabled ? 'border-transparent' : 'border-slate-200 opacity-75 grayscale'}`}
                        >
                            <div className="absolute top-3 left-3 z-10">
                                <span className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-slate-800 text-white tracking-wide">
                                    PAGE {slide.pageNumber}
                                </span>
                            </div>

                            <div className="absolute top-3 right-3 z-10 cursor-pointer" onClick={() => setSlides(s => s.map(x => x.pageNumber === slide.pageNumber ? {...x, enabled: !x.enabled} : x))}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${slide.enabled ? 'bg-indigo-600 text-white scale-100' : 'bg-slate-200 text-slate-400 scale-90 hover:scale-95'}`}>
                                    <Check size={20} strokeWidth={3} />
                                </div>
                            </div>

                            <div className="aspect-video bg-slate-100">
                                <img src={slide.previewUrl} className="w-full h-full object-cover" />
                            </div>
                            
                            <div className="p-4 border-t border-slate-100 bg-white grid grid-cols-2 gap-3">
                                {Object.values(ExtractionMode).map(m => {
                                    const isSelected = slide.mode === m;
                                    return (
                                    <button 
                                        key={m}
                                        onClick={() => updateMode(slide.pageNumber, m)}
                                        disabled={!slide.enabled}
                                        className={`relative p-3 rounded-xl text-left transition border-2 ${isSelected ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-inner' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
                                    >
                                        {isSelected && <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full"></div>}
                                        <div className={`font-bold text-sm mb-0.5 ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{MODE_DETAILS[m].label}</div>
                                        <div className="text-xs opacity-80 font-medium">{MODE_DETAILS[m].desc}</div>
                                    </button>
                                )})}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        
        {showModeInfo && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowModeInfo(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Info size={24} className="text-indigo-600" />
                            変換モードについて
                        </h3>
                        <Button variant="ghost" size="icon" onClick={() => setShowModeInfo(false)}><X size={20} /></Button>
                    </div>
                    <div className="p-6 grid gap-6">
                        {Object.values(ExtractionMode).map(m => {
                            const Icon = MODE_DETAILS[m].icon;
                            return (
                                <div key={m} className="flex gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600">
                                        <Icon size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg mb-1">{MODE_DETAILS[m].label}</h4>
                                        <p className="text-sm font-bold text-slate-500 mb-2">{MODE_DETAILS[m].desc}</p>
                                        <p className="text-sm text-slate-600 leading-relaxed">{MODE_DETAILS[m].longDesc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 text-right">
                        <Button onClick={() => setShowModeInfo(false)}>閉じる</Button>
                    </div>
                </div>
            </div>
        )}

        {status === AppStatus.COMPLETED && (
            <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/30 rotate-12">
                   <Check size={48} strokeWidth={3} />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2">変換完了！</h2>
                <p className="text-slate-500 mb-8 text-lg">ダウンロードフォルダを確認してください</p>
                <Button onClick={reset} size="lg" className="px-12 py-6 rounded-2xl text-xl font-bold shadow-xl shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700">続けて変換する</Button>
            </div>
        )}

        {status === AppStatus.ERROR && (
             <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center">
                <div className="bg-rose-50 text-rose-600 p-10 rounded-3xl text-center border border-rose-100 max-w-lg shadow-2xl">
                    <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">⚠️</div>
                    <h3 className="font-black text-2xl mb-4">エラーが発生しました</h3>
                    <p className="text-md font-medium opacity-80 mb-8 bg-white p-4 rounded-xl border border-rose-100 text-left overflow-auto max-h-40">{error}</p>
                    <Button onClick={reset} variant="outline" size="lg" className="border-2 border-rose-200 text-rose-600 hover:bg-rose-100 px-8 font-bold">戻る</Button>
                </div>
             </div>
        )}
      </div>
    </div>
  );
}