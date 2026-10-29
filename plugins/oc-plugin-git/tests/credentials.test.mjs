import assert from "node:assert/strict"
import nodeFs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  describeCredentialsFile,
  formatCredential,
  gitCredentialsPath,
  matchCredential,
  parseCredential,
  readCredentials,
  removeCredential,
  saveCredential,
} from "../lib/credentials.js"

const temporaryFile = (name = "creds") => {
  const dir = nodeFs.mkdtempSync(path.join(os.tmpdir(), "oc-git-cred-"))
  return path.join(dir, name)
}

test("gitCredentialsPath 默认落在 $XDG_CONFIG_HOME/opencode/git-credentials（108 R3 Android 适配）", () => {
  assert.equal(
    gitCredentialsPath({ XDG_CONFIG_HOME: "/tmp/home/config", HOME: "/tmp/home" }),
    path.resolve("/tmp/home/config", "opencode", "git-credentials"),
  )
})

test("gitCredentialsPath 无 XDG 时回退 $HOME/opencode/git-credentials", () => {
  assert.equal(gitCredentialsPath({ HOME: "/tmp/home" }), path.resolve("/tmp/home", "opencode", "git-credentials"))
})

test("parseCredential 跳过空行 / 注释 / 非 URL / 无 userinfo", () => {
  assert.equal(parseCredential(""), null)
  assert.equal(parseCredential("# comment"), null)
  assert.equal(parseCredential("not a url"), null)
  assert.equal(parseCredential("https://example.com"), null)
})

test("parseCredential 解析协议 / 主机（含端口）/ 用户名 / 口令", () => {
  const parsed = parseCredential("http://user:pass@example.com:8080/team/repo.git")
  assert.deepEqual(parsed, {
    protocol: "http",
    host: "example.com:8080",
    username: "user",
    password: "pass",
    path: "/team/repo.git",
  })
})

test("百分号编码可原样往返（口令含 : @ /）", () => {
  const entry = { protocol: "https", host: "example.com", username: "u@x", password: "p:a@ss/word" }
  const line = formatCredential(entry)
  const parsed = parseCredential(line)
  assert.equal(parsed.username, entry.username)
  assert.equal(parsed.password, entry.password)
})

test("matchCredential：协议与 host 必须一致，带路径行优先，同分靠后者胜", () => {
  const entries = [
    { protocol: "https", host: "example.com", username: "bare", password: "1", path: "" },
    { protocol: "https", host: "example.com", username: "scoped", password: "2", path: "/team" },
    { protocol: "https", host: "example.com", username: "later", password: "3", path: "" },
    { protocol: "http", host: "example.com", username: "wrong-proto", password: "4", path: "" },
  ]
  assert.equal(matchCredential(entries, { protocol: "https", host: "example.com", path: "/team/repo.git" }).username, "scoped")
  assert.equal(matchCredential(entries, { protocol: "https", host: "example.com", path: "/other.git" }).username, "later")
  assert.equal(matchCredential(entries, { protocol: "http", host: "example.com", path: "" }).username, "wrong-proto")
  assert.equal(matchCredential(entries, { protocol: "https", host: "other.com", path: "" }), undefined)
})

const WIN = process.platform === "win32" // Windows chmod 无法置 0600：写入回读校验按设计抛 EPERM（设备侧/POSIX 判据）

test("saveCredential 替换同主机同用户、追加异用户、保留注释与其它行", { skip: WIN ? "Windows chmod 语义（0600 判据在 POSIX/设备复核）" : false }, () => {
  const file = temporaryFile()
  nodeFs.writeFileSync(file, "# keep me\nhttps://example.com/other.git\thttps://a:b@x.com\n")
  saveCredential({ protocol: "https", host: "example.com", username: "u", password: "p1" }, file)
  saveCredential({ protocol: "https", host: "example.com", username: "u", password: "p2" }, file)
  saveCredential({ protocol: "https", host: "example.com", username: "v", password: "p3" }, file)
  const text = nodeFs.readFileSync(file, "utf8")
  assert.match(text, /# keep me/u)
  assert.equal((text.match(/@example\.com/gu) ?? []).length, 2, text)
  assert.match(text, /u:p2@example\.com/u)
  assert.match(text, /v:p3@example\.com/u)
})

test("saveCredential 强制 0600（非 Windows）", { skip: process.platform === "win32" }, () => {
  const file = temporaryFile()
  nodeFs.writeFileSync(file, "", { mode: 0o644 })
  saveCredential({ protocol: "https", host: "example.com", username: "u", password: "p" }, file)
  assert.equal(nodeFs.statSync(file).mode & 0o777, 0o600)
})

test("removeCredential 只删匹配行，删空即删文件", { skip: WIN ? "Windows chmod 语义（0600 判据在 POSIX/设备复核）" : false }, () => {
  const file = temporaryFile()
  saveCredential({ protocol: "https", host: "a.com", username: "u", password: "p" }, file)
  assert.equal(removeCredential({ protocol: "https", host: "b.com", username: "u" }, file).removed, 0)
  assert.equal(removeCredential({ protocol: "https", host: "a.com", username: "u" }, file).removed, 1)
  assert.equal(nodeFs.existsSync(file), false)
})

test("文件缺失读作「没有凭据」且 describe 不抛错", () => {
  const file = temporaryFile("missing")
  assert.deepEqual(readCredentials(file), [])
  const described = describeCredentialsFile(file)
  assert.equal(described.exists, false)
  assert.equal(described.count, 0)
})

test("describeCredentialsFile 返回路径 / 模式 / 条目数", { skip: process.platform === "win32" }, () => {
  const file = temporaryFile()
  saveCredential({ protocol: "https", host: "a.com", username: "u", password: "p" }, file)
  const described = describeCredentialsFile(file)
  assert.equal(described.exists, true)
  assert.equal(described.mode, "600")
  assert.equal(described.count, 1)
})
