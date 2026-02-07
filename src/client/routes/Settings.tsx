import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { client } from "@/client/lib/api-client"
import { authClient } from "@/client/lib/auth-client"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { Label } from "@/client/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card"

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
                    Gemini API設定
                    {hasKey && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">
                        設定済み ✅
                    </span>
                    )}
                </CardTitle>
                <CardDescription>
                    PDF生成に使用するGoogle GeminiのAPIキーを設定してください。
                </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>ログアウト</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Gemini API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={hasKey ? "*************** (設定済み)" : "AIzaSy..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {session.user.image && <img src={session.user.image} className="w-6 h-6 rounded-full" />}
            <p className="text-sm text-slate-500">
                {session.user.name}
            </p>
          </div>
          <Button onClick={handleSave} disabled={isLoading || !apiKey}>
            {isLoading ? "保存中..." : "保存する"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}