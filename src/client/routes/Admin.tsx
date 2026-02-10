import { useState, useEffect, useCallback } from "react";
import { client } from "@/client/lib/api-client";
import { Button } from "@/client/components/ui/button";
import { authClient } from "@/client/lib/auth-client";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Trash2, Plus, ArrowLeft, Loader2 } from "lucide-react";

// 環境変数
const RAW_ADMIN_EMAILS = import.meta.env.VITE_ADMIN_EMAIL || "";
const ADMIN_EMAILS = RAW_ADMIN_EMAILS.split(",").map((e: string) => e.trim());

export default function Admin() {
  const { data: session, isPending } = authClient.useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    try {
      // @ts-ignore
      const res = await client.api.admin.users.$get();
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
      setError("リストを取得できませんでした");
    } finally {
      setFetching(false);
    }
  }, []);

  // 権限があるときだけfetchを実行
  useEffect(() => {
    const isAllowed = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);
    if (!isPending && isAllowed) {
        fetchUsers();
    }
  }, [fetchUsers, session, isPending]);

  if (isPending) {
    return <div className="flex justify-center p-20 text-slate-500">Checking Permission...</div>;
  }

  // 権限チェック
  const isAllowed = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);
  if (!session || !isAllowed) {
    return <Navigate to="/" />;
  }

  const addUser = async () => {
    if (!newEmail) return;
    setSubmitting(true);
    try {
      // @ts-ignore
      const res = await client.api.admin.users.$post({ json: { email: newEmail } });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "追加に失敗しました");
      }
      setNewEmail("");
      await fetchUsers();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeUser = async (email: string) => {
    if (!confirm(`${email} を削除しますか？`)) return;
    setSubmitting(true);
    try {
      // @ts-ignore
      const res = await client.api.admin.users.$delete({ json: { email } });
      if (!res.ok) throw new Error("削除に失敗しました");
      await fetchUsers();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (fetching && users.length === 0) {
      return <div className="p-10 text-center text-slate-500">Loading List...</div>;
  }
  
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <Link to="/settings">
            <Button variant="outline" size="icon"><ArrowLeft size={20}/></Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">ユーザー管理</h1>
        </header>

        {/* 新規追加エリア */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
            <h2 className="font-bold mb-4">新規追加</h2>
            <div className="flex gap-2">
                <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    disabled={submitting}
                    className="flex-1 border rounded-md px-3 py-2 disabled:bg-slate-100"
                />
                <Button 
                  onClick={addUser} 
                  disabled={submitting || !newEmail}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                    {submitting ? (
                      <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                      <Plus size={16} className="mr-2" />
                    )}
                    追加
                </Button>
            </div>
        </div>

        {/* ユーザー一覧エリア */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="p-4 font-bold text-slate-600">Email</th>
                        <th className="p-4 font-bold text-slate-600 text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.email} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="p-4">{u.email}</td>
                            <td className="p-4 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => removeUser(u.email)} 
                                  disabled={submitting}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </td>
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr><td colSpan={2} className="p-8 text-center text-slate-400">ユーザーがいません</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}