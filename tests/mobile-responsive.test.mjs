import assert from 'node:assert/strict'
import {readdir,readFile} from 'node:fs/promises'

async function cssFiles(directory){
 const entries=await readdir(directory,{withFileTypes:true})
 const nested=await Promise.all(entries.map(entry=>{
  const path=`${directory}/${entry.name}`
  return entry.isDirectory()?cssFiles(path):entry.isFile()&&entry.name.endsWith('.css')?[path]:[]
 }))
 return nested.flat().sort()
}

const [html,main,app,mobile]=await Promise.all([
 readFile('index.html','utf8'),
 readFile('src/main.jsx','utf8'),
 readFile('src/App.jsx','utf8'),
 readFile('src/design/mobile.css','utf8'),
])

assert.match(html,/name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/)
assert.ok(main.includes("./design/mobile.css"),'Shared responsive safeguards load after route styles')
assert.ok(app.includes('<MemberShell')&&app.includes('<Admin />'),'Member and admin route shells remain in the app')
for(const rule of ['100dvh','safe-area-inset-top','safe-area-inset-bottom','text-size-adjust','font-size: 16px','min-height: 44px','overscroll-behavior-y: contain','overflow-x: clip'])assert.ok(mobile.includes(rule),rule)
assert.match(mobile,/\.member-sidebar,\s*\.ad-sidebar\s*\{\s*top:\s*0;/,'Mobile drawers stay within the safe-area padding instead of double-offsetting the viewport')
assert.match(mobile,/\.member-sidebar nav\s*\{\s*flex:\s*1;[\s\S]*?overflow-y:\s*auto;/,'Member navigation remains scrollable on short screens')
assert.doesNotMatch(mobile,/\.member-shell,\s*\.ad-shell\s*\{[^}]*padding-top:/,'Safe-area top padding belongs to the top bars and drawer content')

const pageAndAdminStyles=[...await cssFiles('src/pages'),...await cssFiles('src/admin')]
for(const path of pageAndAdminStyles){
 const css=await readFile(path,'utf8')
 assert.match(css,/@media[^{}]*max-width\s*:\s*[\d.]+(?:px|em|rem)/i,`${path} has a narrow-screen rule`)
}
for(const path of ['src/design/system.css','src/design/edition.css','src/design/premium.css','src/design/theme.css','src/member/member.css']){
 const css=await readFile(path,'utf8')
 assert.match(css,/@media[^{}]*max-width\s*:\s*[\d.]+(?:px|em|rem)/i,`${path} has a narrow-screen rule`)
}
console.log(`PASS mobile safeguards: viewport-fit, shared route coverage, ${pageAndAdminStyles.length} page/admin stylesheets with narrow-screen rules, safe areas, dynamic-height layouts, 44px touch targets, iOS form zoom prevention, and contained dialog scrolling. Static coverage only; no physical Android/iOS device test.`)
