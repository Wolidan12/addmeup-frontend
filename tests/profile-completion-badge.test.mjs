import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasCompleteProfile, PROFILE_BADGE_DESCRIPTION } from '../src/lib/profileBadge.js';
const profile = {display_name:'Creator',username:'creator',avatar_url:'https://example.org/photo.jpg',bio:'My story',country:'NG',interests:['music']};
assert.equal(hasCompleteProfile(profile),true);
assert.equal(hasCompleteProfile({...profile,managed:true}),false);
assert.equal(hasCompleteProfile(null),false);
for (const key of ['display_name','username','avatar_url','bio','country']) {
  for (const value of [undefined,null,'','   ',42]) assert.equal(hasCompleteProfile({...profile,[key]:value}),false,key);
}
for(const interests of [[],null,undefined,'music',[' '],[null]])assert.equal(hasCompleteProfile({...profile,interests}),false);
assert.equal(hasCompleteProfile({...profile,social_links:[]}),true,'social links are optional for the required-field mark');
assert.equal(hasCompleteProfile({paid_premium_badge:true,verified:true,profile_complete:true}),false,'client flags cannot grant the mark');
assert.match(PROFILE_BADGE_DESCRIPTION,/Not identity verification/);
const built=await build({entryPoints:['src/components/ProfileCompletionBadge.jsx'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const module={exports:{}};vm.runInNewContext(built.outputFiles[0].text,{module,exports:module.exports,require:createRequire(import.meta.url)});
const Badge=module.exports.default,render=p=>renderToStaticMarkup(React.createElement(Badge,{profile:p}));
assert.match(render(profile),/aria-label="Profile complete"/);
assert.match(render(profile),/<svg/);assert.match(render(profile),/Not identity verification/);
assert.equal(render({...profile,bio:''}),'');assert.equal(render({...profile,managed:true}),'');
for(const file of ['src/components/ui.jsx','src/member/MemberLayout.jsx','src/pages/MemberDashboard.jsx'])assert.match(await readFile(file,'utf8'),/<ProfileCompletionBadge profile=/);
assert.match(await readFile('src/design/premium.css','utf8'),/fill: #a855f7/);
console.log('PASS purple completion badge: six required fields, blank/missing/incomplete denial, automatic removal, managed/paid exclusion, accessible SVG and shared placement. Not identity verification.');
