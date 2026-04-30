import{s as e}from"./chunk-Bj-mKKzh.js";import{d as t,p as n,t as r}from"./path-browserify-Chh2Zpai.js";import{l as i}from"./quote-cmd-oSxnEoQp.js";var a=n({"codex/browserUse":t(!0)});function o({resultMeta:e,serverName:t}){return t===`node_repl`&&a.safeParse(e).success?`browser-use`:null}function s(e){return e.source===`browser-use`}var c=e(r(),1);function l(e,t){if(t.type===`update`){let n=e,r=t.move_path??e,i=t.unified_diff.trimStart(),a=/\n?---\s/.test(i),o=/^diff --git /m.test(i),s=a?i:`--- a/${n}\n+++ b/${r}\n${i}`;return`${o?``:`diff --git a/${n} b/${r}\n`}${s}`}if(t.type===`add`){let n=t.content.replace(/\r\n/g,`
`).split(`
`),r=n.length>0&&n[n.length-1]===``?n.slice(0,-1):n,i=r.length,a=r.map(e=>`+`+e).join(`
`),o=i>0?`@@ -0,0 +1,${i} @@\n${a}\n`:``;return[`diff --git a/${e} b/${e}`,`new file mode 100644`,`--- /dev/null`,`+++ b/${e}`,o].filter(Boolean).join(`
`)}if(t.type===`delete`){let n=t.content.replace(/\r\n/g,`
`).split(`
`),r=n.length>0&&n[n.length-1]===``?n.slice(0,-1):n,i=r.length,a=r.map(e=>`-`+e).join(`
`),o=i>0?`@@ -1,${i} +0,0 @@\n${a}\n`:``;return[`diff --git a/${e} b/${e}`,`deleted file mode 100644`,`--- a/${e}`,`+++ /dev/null`,o].filter(Boolean).join(`
`)}return null}function u(e,t,n){return Object.entries(e).flatMap(([e,r])=>{let i=l(p(e,t,n),f(r,t,n));return i==null?[]:[i]}).join(`
`)}function d(e,t){let n=[],r=new Map;for(let{changes:i,cwd:a}of e)for(let[e,o]of Object.entries(i)){let i=p(e,a,t),s=f(o,a,t),c=l(i,s);if(c==null)continue;let u=s.type===`update`&&s.move_path!=null?s.move_path:i,d=`${a??``}\0${u}`,m=s.type===`update`&&s.move_path==null,h=c.replace(/[\r\n]+$/,``),g=r.get(d);if(m&&g!=null){let e=h.startsWith(`@@`),t=e?0:h.indexOf(`
@@`);if(t!==-1){let r=e?h:h.slice(t+1);n[g]=`${n[g]}\n${r}`;continue}}n.push(h),m?r.set(d,n.length-1):r.delete(d)}let i=n.join(`

`);return i.length>0?`${i}\n`:``}function f(e,t,n){return e.type===`update`&&e.move_path!=null?{...e,move_path:p(e.move_path,t,n)}:e}function p(e,t,n){if(n==null)return e;let r=i(e,n);if(r!==e||t==null||t===n)return r;let a=i(t,n);return a===t||e===a||e.startsWith(`${a}/`)?e:c.default.posix.join(a,e)}export{s as a,o as i,l as n,u as r,d as t};
//# sourceMappingURL=build-unified-git-diff-text-CN4M2BpO.js.map