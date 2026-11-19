import fs from 'node:fs';

function analyticsScriptPath(){
  if(process.env.VERCEL!=='1')return '';
  let path;
  try {
    path=JSON.parse(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG||'{}').analytics?.scriptSrc;
  } catch {}
  // The deployment can supply a project-specific same-origin analytics route.
  return typeof path==='string'&&/^(?:\/[\w.-]+)+\/script\.js$/.test(path)
    ?path:'/_vercel/insights/script.js';
}

fs.mkdirSync('dist',{recursive:true});
const html=fs.readFileSync('index.html','utf8');
const analyticsPath=analyticsScriptPath();
const analytics=analyticsPath?`
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="${analyticsPath}"></script>
`:'';
fs.writeFileSync('dist/index.html',html.replace('</head>',analytics+'</head>'));

for(const file of ['style.css','app.js','astro.js','sky-model.js','sky-renderer.js','planets.js','orientation.js','viewer-ui.js','modal-focus.js','sky-details.js','details-ui.js','wishes.js','wish-entrance.js','community.js','community-rules.js','more.js','achievements.js','stamp-validation.js','observation-time.js','constellation-guide.js','constellation-art.js','viewer-navigation.js','viewer-tutorial.js']){
  fs.copyFileSync(file,'dist/'+file);
}
for(const folder of ['data','assets','vendor'])fs.cpSync(folder,'dist/'+folder,{recursive:true});
console.log('Static production build ready: dist/');
