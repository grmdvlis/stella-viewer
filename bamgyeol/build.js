import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});for(const f of ['index.html','style.css','app.js','astro.js','sky-model.js','sky-renderer.js','planets.js'])fs.copyFileSync(f,'dist/'+f);for(const folder of ['data','assets','vendor'])fs.cpSync(folder,'dist/'+folder,{recursive:true});console.log('Static production build ready: dist/');
