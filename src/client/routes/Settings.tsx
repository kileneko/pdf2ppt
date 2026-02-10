import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { client } from "@/client/lib/api-client"
import { authClient } from "@/client/lib/auth-client"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { Label } from "@/client/components/ui/label"
import { Shield, ArrowRight, LogOut } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card"

// 管理者リスト取得
const RAW_ADMIN_EMAILS = import.meta.env.VITE_ADMIN_EMAIL || "";
const ADMIN_EMAILS = RAW_ADMIN_EMAILS.split(",").map((e: string) => e.trim());

export default function Settings() {
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await authClient.getSession()
      setSession(sessionData)
      setIsAuthChecking(false)

      if (sessionData) {
        const res = await client.api.settings.$get()
        if (res.ok) {
          const json = await res.json()
          setHasKey(json.hasKey)
        }
      }
    }
    init()
  }, [])

  const handleSave = async () => {
    if (!apiKey) return
    setIsLoading(true)

    try {
      const res = await client.api.settings.$post({
        json: { apiKey },
      })

      if (res.ok) {
        setHasKey(true)
        setApiKey("") 
        alert("APIキーを保存しました！🔐")
      } else {
        alert("保存に失敗しました。")
      }
    } catch (e) {
      console.error(e)
      alert("エラーが発生しました。")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/settings`
    })
  }

  const handleSignOut = async () => {
      await authClient.signOut({
          fetchOptions: {
              onSuccess: () => {
                  window.location.href = "/"
              }
          }
      })
  }

  if (isAuthChecking) {
    return <div className="text-center p-10">Loading...</div>
  }

  if (!session) {
    return (
      <div className="container mx-auto p-8 max-w-2xl text-center">
        <div className="mb-6 flex justify-start">
            <Link to="/">
                <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-indigo-600">
                    ← ホームに戻る
                </Button>
            </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>
              APIキーを設定するにはGoogleアカウントでログインしてください。
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={handleSignIn} className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-50">
                Googleでサインイン
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // 管理者判定
  const isAdmin = session.user.email && ADMIN_EMAILS.includes(session.user.email);

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-6 flex justify-start">
        <Link to="/">
            <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-indigo-600">
                ← ホームに戻る
            </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center gap-2">
                    設定
                </CardTitle>
                <CardDescription>
                    アプリケーションの設定と管理を行います。
                </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 管理者エリア */}
          {isAdmin && (
             <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-md">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-indigo-900 text-sm">管理者メニュー</h3>
                        <p className="text-xs text-indigo-700">ユーザー管理・権限設定</p>
                    </div>
                </div>
                <Link to="/admin">
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        管理画面へ <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
             </div>
           )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="api-key" className="text-base font-semibold">Gemini API Key</Label>
                {hasKey && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                        設定済み ✅
                    </span>
                )}
            </div>
            <p className="text-sm text-slate-500 mb-2">
                PDF生成に使用するGoogle GeminiのAPIキーを設定してください。
            </p>
            <div className="flex gap-2">
                <Input
                id="api-key"
                type="password"
                placeholder={hasKey ? "*************** (設定済み)" : "AIzaSy..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                />
                <Button onClick={handleSave} disabled={isLoading || !apiKey}>
                    {isLoading ? "保存中..." : "保存"}
                </Button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center border-t pt-6">
          <div className="flex items-center gap-2">
            {session.user.image && <img src={session.user.image} className="w-8 h-8 rounded-full border border-slate-200" />}
            <div>
                <p className="text-sm font-medium text-slate-700">{session.user.name}</p>
                <p className="text-xs text-slate-500">{session.user.email}</p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleSignOut} className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200">
            <LogOut className="w-4 h-4 mr-2" />
            ログアウト
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}