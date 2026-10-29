import assert from "node:assert/strict"
import { test } from "node:test"
import { redactUrl } from "../lib/auth.js"

test("redactUrl 吃掉整个 userinfo（口令含编码斜杠 %2F 也不残留）", () => {
  const out = redactUrl("https://oc:p%2Fss@github.com/x/y.git")
  assert.ok(!out.includes("p%2Fss") && !out.includes("oc:"), `secret leaked: ${out}`)
  assert.ok(out.startsWith("https://*@github.com/x/y.git"), out)
})

test("redactUrl 普通形（用户名+口令，口令含字面 / 的场景由编码承担）", () => {
  const out = redactUrl("https://user:token123@gitlab.com/a")
  assert.ok(!out.includes("token123") && !out.includes("user@"), `secret leaked: ${out}`)
  assert.ok(out.startsWith("https://*@gitlab.com/a"), out)
})

test("redactUrl 无 userinfo 原样", () => {
  assert.equal(redactUrl("https://github.com/a"), "https://github.com/a")
})
