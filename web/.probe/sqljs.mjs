import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js");
const SQL = await initSqlJs();
const db = new SQL.Database();
db.run("select sqlite_version()");
const st = db.prepare("select sqlite_version() v");
st.step(); console.log("sqlite", st.getAsObject()); st.free();
db.run(`create table t (a text, b integer primary key,
  c text generated always as (json_extract(a, '$.k')) virtual) without rowid`);
db.run(`create view v as select b, json_extract(x.value,'$.n') n from t, json_each(t.a,'$.list') x where t.a is not null`);
const ins = db.prepare("insert into t (a,b) values (?,?)");
for (const p of [['{"k":"kk","list":[{"n":1},{"n":2}]}',1],[null,2]]) { ins.run(p); }
ins.free();
const q = db.prepare("select a,b,c from t order by b");
const rows=[]; while(q.step()) rows.push(q.getAsObject()); q.free();
console.log("rows", JSON.stringify(rows));
const vq = db.prepare("select b,n from v"); const vr=[]; while(vq.step()) vr.push(vq.getAsObject()); vq.free();
console.log("view", JSON.stringify(vr));
const m = db.prepare("select a from t where b = ?"); m.bind([99]); console.log("miss", m.step()); m.free();
