import { useState, useEffect } from "react";
import { client } from "@/client/lib/api-client";
import { Button } from "@/client/components/ui/button";
import { authClient } from "@/client/lib/auth-client";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, ArrowLeft } from "lucide-react";

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      // @ts-ignore
      const res = await client.api.admin.users.$get();
      if (!res.ok) throw new Error("権限がありません");
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError("アクセスできませんでした");
      setTimeout(() => navigate("/"), 2000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async () => {
    if (!newEmail) return;
    // @ts-ignore
    await client.api.admin.users.$post({ json: { email: newEmail } });
    setNewEmail("");
    fetchUsers();
  };

  const removeUser = async (email: string) => {
    if (!confirm(`${email} を削除しますか？`)) return;
    // @ts-ignore
    await client.api.admin.users.$delete({ json: { email } });
    fetchUsers();
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="outline" size="icon"><ArrowLeft size={20}/></Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">ユーザー管理</h1>
        </header>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
            <h2 className="font-bold mb-4">新規追加</h2>
            <div className="flex gap-2">
                <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="flex-1 border rounded-md px-3 py-2"
                />
                <Button onClick={addUser} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus size={16} className="mr-2" /> 追加
                </Button>
            </div>
        </div>

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
                                <Button variant="ghost" size="sm" onClick={() => removeUser(u.email)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50">
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