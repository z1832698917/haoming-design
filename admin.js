// ─── CONFIG ───
var IMGBB_API_KEY = '2c38d36238be760dde2abd6a3d8ebaee';
var STORAGE_KEY = 'haoming_works';

// GitHub auto-sync (using GitHub token from config — stored in localStorage)
var GH_TOKEN_KEY = 'haoming_gh_token';
var GH_OWNER = 'z1832698917';
var GH_REPO  = 'haoming-design';
var GH_BRANCH = 'main';

// ─── STATE ───
var works = [];
var currentFilter = 'all';
var dominantHue = 220, accentSat = 20, accentLig = 8;
var selectedTag = 'photography';
var isUploading = false;
var $ = function(id){return document.getElementById(id);};
var masonry = $('masonry');

// ─── PERSISTENCE ───
function saveWorks() {
  var data = works.map(function(w){return{src:w.src,title:w.title,tags:w.tags,h:w.colors.h,s:w.colors.s,l:w.colors.l};});
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  updateManifest();
}

function loadWorks() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    data.forEach(function(item){addWork(item.src,item.title,item.tags,item.h,false);});
  } catch(e){}
}

// ─── COLOR ───
function extractColors(img) {
  try {
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    var size = 60;
    c.width = c.height = size;
    ctx.drawImage(img,0,0,size,size);
    var d = ctx.getImageData(0,0,size,size).data;
    var rS=0,gS=0,bS=0,cnt=0;
    for (var i=0;i<d.length;i+=16){rS+=d[i];gS+=d[i+1];bS+=d[i+2];cnt++;}
    if(!cnt) throw 0;
    var hsl = rgbToHsl(Math.round(rS/cnt),Math.round(gS/cnt),Math.round(bS/cnt));
    return{h:Math.round(hsl[0]),s:Math.round(hsl[1]*100),l:Math.round(hsl[2]*100)};
  } catch(e){return{h:220,s:20,l:15};}
}

function rgbToHsl(r,g,b) {
  r/=255;g/=255;b/=255;
  var max=Math.max(r,g,b),min=Math.min(r,g,b);
  var h,s,l=(max+min)/2;
  if(max===min){h=s=0;}
  else{
    var d=max-min;
    s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}
  }
  return[h*360,s,l];
}

function applyTheme(colors) {
  dominantHue = colors.h;
  accentSat = Math.max(15,colors.s*0.6);
  accentLig = Math.max(5,Math.min(20,colors.l*0.18));
  document.documentElement.style.setProperty('--hue',colors.h);
  document.documentElement.style.setProperty('--sat',accentSat+'%');
  document.documentElement.style.setProperty('--lig',accentLig+'%');
  var dot = $('colorDot');
  dot.style.background = 'hsl('+colors.h+','+colors.s+'%,'+colors.l+'%)';
  dot.style.boxShadow = '0 0 16px hsl('+colors.h+','+colors.s+'%,'+colors.l+'%)';
  var cur = $('hueCursor');
  if(cur) cur.style.left = (colors.h/360)*100+'%';
}

function blendTheme(colors,weight) {
  weight = weight||0.3;
  var b = {
    h:Math.round(dominantHue*(1-weight)+colors.h*weight),
    s:Math.round(accentSat*(1-weight)+Math.max(15,colors.s*0.6)*weight),
    l:Math.round(accentLig*(1-weight)+Math.max(5,Math.min(20,colors.l*0.18))*weight)
  };
  applyTheme(b);
}

function recalcDominant() {
  if(!works.length){applyTheme({h:220,s:20,l:8});return;}
  var n=works.length;
  applyTheme({
    h:works.reduce(function(s,w){return s+w.colors.h;},0)/n,
    s:works.reduce(function(s,w){return s+w.colors.s;},0)/n,
    l:works.reduce(function(s,w){return s+w.colors.l;},0)/n
  });
}

// ─── ADD WORK ───
function addWork(src,title,tags,forcedHue,doSave) {
  doSave = (doSave!==false);
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    var colors = extractColors(img);
    if(forcedHue!==undefined) colors.h = forcedHue;
    var id = Date.now()+Math.random();

    var card = document.createElement('div');
    card.className = 'card';
    card.dataset.tags = tags.join(',');
    card.style.animationDelay = (Math.random()*0.3)+'s';

    var tagsHtml = tags.map(function(t){return'<span class="card-tag">'+t+'</span>';}).join('');
    card.innerHTML = '<img src="'+src+'" alt="'+title.replace(/"/g,'&quot;')+'" loading="lazy"><div class="card-overlay"><div class="card-info"><div class="card-title">'+title.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+tagsHtml+'</div><div class="card-actions"><button class="card-btn copy-btn" title="复制链接">🔗</button><button class="card-btn" title="删除">✕</button></div></div>';

    card.addEventListener('click',function(e){
      if(!e.target.classList.contains('card-btn')) openLightbox(src,title,tags);
    });
    card.querySelector('.copy-btn').addEventListener('click',function(e){
      e.stopPropagation();
      navigator.clipboard.writeText(src).then(function(){toast('链接已复制','success');});
    });
    card.querySelector('[title="删除"]').addEventListener('click',function(e){
      e.stopPropagation();
      deleteWork(id);
    });
    card.addEventListener('mouseenter',function(){blendTheme(colors,0.25);});

    masonry.appendChild(card);
    works.push({id:id,src:src,title:title,tags:tags,colors:colors,element:card});

    if(doSave) saveWorks();
    recalcDominant();
    updateStats();
    revealCards();
  };
  img.onerror = function(){};
  img.src = src;
}

function deleteWork(id) {
  var idx = -1;
  for(var i=0;i<works.length;i++){if(works[i].id===id){idx=i;break;}}
  if(idx===-1) return;
  var card = works[idx].element;
  card.style.transition = 'opacity 0.4s, transform 0.4s';
  card.style.opacity = '0';
  card.style.transform = 'scale(0.8)';
  setTimeout(function(){
    card.remove();
    works.splice(idx,1);
    recalcDominant();
    updateStats();
    saveWorks();
    if(currentFilter!=='all') applyFilter();
  },400);
}

// ─── FILTER ───
$('filterBar').addEventListener('click',function(e){
  if(!e.target.classList.contains('filter-btn')) return;
  currentFilter = e.target.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active');});
  e.target.classList.add('active');
  applyFilter();
});

function applyFilter() {
  var visible=0;
  works.forEach(function(w){
    var show = currentFilter==='all' || w.tags.indexOf(currentFilter)!==-1;
    w.element.style.display = show?'':'none';
    if(show) visible++;
  });
  $('statFiltered').textContent = visible;
}

function updateStats() {
  $('statTotal').textContent = works.length;
  $('statFiltered').textContent = works.length;
  var imgbbCount = 0;
  for(var i=0;i<works.length;i++){if(works[i].src.indexOf('imgbb')!==-1) imgbbCount++;}
  $('statImgbb').textContent = imgbbCount || '—';
  updateManifest();
}

// ─── LIGHTBOX ───
function openLightbox(src,title,tags) {
  $('lightboxImg').src = src;
  $('lightboxTitle').textContent = title;
  $('lightboxTags').innerHTML = tags.map(function(t){return'<span class="lightbox-tag">'+t+'</span>';}).join('');
  $('lightbox').classList.add('open');
  for(var i=0;i<works.length;i++){if(works[i].src===src){blendTheme(works[i].colors,0.5);break;}}
}

function closeLightbox() {
  $('lightbox').classList.remove('open');
  recalcDominant();
}

$('lightboxClose').addEventListener('click',closeLightbox);
$('lightbox').addEventListener('click',function(e){if(e.target===$('lightbox')) closeLightbox();});
document.addEventListener('keydown',function(e){if(e.key==='Escape') closeLightbox();});

// ─── TOAST ───
function toast(msg,type) {
  var el = $('toast');
  el.textContent = msg;
  el.className = 'toast show'+(type?' '+type:'');
  clearTimeout(el._timer);
  el._timer = setTimeout(function(){el.classList.remove('show');},3000);
}

// ─── IMGBB UPLOAD ───
async function uploadToImgBB(file) {
  return new Promise(function(resolve,reject){
    var reader = new FileReader();
    reader.onload = function(e){
      var base64 = e.target.result.split(',')[1];
      var fd = new FormData();
      fd.append('key',IMGBB_API_KEY);
      fd.append('image',base64);
      fd.append('name',file.name);
      fetch('https://api.imgbb.com/1/upload',{method:'POST',body:fd})
        .then(function(r){return r.json();})
        .then(function(data){
          if(data.success) resolve(data.data.url);
          else reject(new Error(data.error&&data.error.message||'上传失败'));
        })
        .catch(reject);
    };
    reader.onerror = function(){reject(new Error('读取文件失败'));};
    reader.readAsDataURL(file);
  });
}

function parseTagsFromName(name) {
  name = name.toLowerCase();
  if(name.indexOf('main')!==-1||name.indexOf('主图')!==-1) return ['main-image','photography'];
  if(name.indexOf('sub')!==-1||name.indexOf('副图')!==-1) return ['sub-image','photography'];
  if(name.indexOf('a+')!==-1||name.indexOf('aplus')!==-1||name.indexOf('A+')!==-1) return ['aplus','photography'];
  return ['photography'];
}

function parseTitleFromName(name) {
  return name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ').replace(/main|sub|主图|副图|aplus|a\+/gi,'').trim()||'作品 '+(works.length+1);
}

async function handleFiles(files) {
  var allowed = Array.prototype.slice.call(files).filter(function(f){return f.type.indexOf('image')===0;});
  if(!allowed.length) return;
  isUploading = true;
  setUploadUI(true,'正在上传 '+allowed.length+' 张…');
  var done=0,ok=0;
  var progress = $('uploadProgress');
  for(var fi=0;fi<allowed.length;fi++){
    (function(file){
      setUploadUI(true,'上传中 '+(done+1)+'/'+allowed.length+'…');
      uploadToImgBB(file).then(function(url){
        ok++;
        addWork(url,parseTitleFromName(file.name),parseTagsFromName(file.name));
        done++; progress.style.width = ((done/allowed.length)*100)+'%';
        if(done===allowed.length) finishUpload(ok);
      }).catch(function(err){
        toast(file.name+' 上传失败','error');
        done++; progress.style.width = ((done/allowed.length)*100)+'%';
        if(done===allowed.length) finishUpload(ok);
      });
    })(allowed[fi]);
  }
}

function finishUpload(ok) {
  isUploading = false;
  setUploadUI(false,'拖拽或点击上传图片');
  $('uploadProgress').style.width = '0%';
  setTimeout(function(){toast('✅ '+ok+' 张作品已添加，公开可访问','success');},300);
}

function setUploadUI(uploading,text) {
  var box = $('uploadBox');
  box.querySelector('.upload-text').textContent = text;
  box.querySelector('.upload-hint').textContent = uploading?'请稍候…':'JPG · PNG · WEBP · 自动识别分类';
}

var fileInput = $('fileInput');
var uploadBox = $('uploadBox');
uploadBox.addEventListener('dragover',function(e){e.preventDefault();if(!isUploading) uploadBox.classList.add('drag-over');});
uploadBox.addEventListener('dragleave',function(){uploadBox.classList.remove('drag-over');});
uploadBox.addEventListener('drop',function(e){e.preventDefault();uploadBox.classList.remove('drag-over');if(!isUploading) handleFiles(e.dataTransfer.files);});
fileInput.addEventListener('change',function(){if(!isUploading) handleFiles(this.files);});

// ─── MANUAL ADD ───
$('tagSelect').addEventListener('click',function(e){
  if(!e.target.classList.contains('tag-option')) return;
  document.querySelectorAll('.tag-option').forEach(function(o){o.classList.remove('selected');});
  e.target.classList.add('selected');
  selectedTag = e.target.dataset.tag;
});

var manualUrl = $('manualUrl');
var addManualBtn = $('addManualBtn');
manualUrl.addEventListener('input',function(){addManualBtn.disabled = !manualUrl.value.trim();});
addManualBtn.addEventListener('click',function(){
  var url = manualUrl.value.trim();
  if(!url) return;
  var title = $('manualTitle').value.trim()||'作品 '+(works.length+1);
  addWork(url,title,[selectedTag]);
  manualUrl.value = '';
  $('manualTitle').value = '';
  addManualBtn.disabled = true;
  toast('作品已添加','success');
});

// ─── GITHUB AUTO SYNC ───
function getGitHubToken() {
  return localStorage.getItem(GH_TOKEN_KEY);
}

function setGitHubToken(token) {
  localStorage.setItem(GH_TOKEN_KEY, token);
  // Verify token works
  fetch('https://api.github.com/user', {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
  }).then(function(r){ return r.json(); }).then(function(data) {
    if (data.login) toast('GitHub 已连接：@'+data.login, 'success');
    else toast('Token 验证失败，请检查', 'error');
  }).catch(function(){ toast('Token 验证失败，请检查', 'error'); });
}

async function pushToGitHub() {
  var token = getGitHubToken();
  if (!token) return;
  var data = {version:Date.now(),works:works.map(function(w){return{src:w.src,title:w.title,tags:w.tags};})};
  var json = JSON.stringify(data, null, 2);
  // Get current SHA
  try {
    var shaResp = await fetch('https://api.github.com/repos/'+GH_OWNER+'/'+GH_REPO+'/contents/manifest.json?ref='+GH_BRANCH, {
      headers: { Authorization: 'Bearer '+token, Accept: 'application/vnd.github+json' }
    });
    var shaData = await shaResp.json();
    var sha = shaData.sha;

    var body = JSON.stringify({
      message: 'Auto sync from 好明设计 admin',
      content: btoa(unescape(encodeURIComponent(json))),
      sha: sha
    });
    var resp = await fetch('https://api.github.com/repos/'+GH_OWNER+'/'+GH_REPO+'/contents/manifest.json', {
      method: 'PUT',
      headers: { Authorization: 'Bearer '+token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body
    });
    if (resp.ok) {
      toast('已同步到云端，展示页自动更新', 'success');
    } else {
      var err = await resp.json();
      toast('同步失败：'+err.message, 'error');
    }
  } catch(e) {
    toast('同步失败：'+e.message, 'error');
  }
}

async function pullFromGitHub() {
  var token = getGitHubToken();
  if (!token) { toast('请先设置 GitHub Token', 'error'); return; }
  try {
    var resp = await fetch('https://api.github.com/repos/'+GH_OWNER+'/'+GH_REPO+'/contents/manifest.json?ref='+GH_BRANCH, {
      headers: { Authorization: 'Bearer '+token, Accept: 'application/vnd.github+json' }
    });
    if (!resp.ok) throw new Error('拉取失败');
    var data = await resp.json();
    var manifest = JSON.parse(atob(data.content));
    var existing = {};
    for(var i=0;i<works.length;i++) existing[works[i].src] = true;
    var added=0;
    (manifest.works||[]).forEach(function(item) {
      if(!existing[item.src]) { addWork(item.src,item.title||'作品',item.tags||['photography']); added++; }
    });
    toast('从云端拉取了 '+added+' 张新作品', 'success');
  } catch(e) { toast('拉取失败：'+e.message, 'error'); }
}

// ─── MANIFEST ───
function updateManifest() {
  var data = {version:Date.now(),works:works.map(function(w){return{src:w.src,title:w.title,tags:w.tags};})};
  $('manifestOutput').value = JSON.stringify(data,null,2);
  // Auto-push to GitHub if token is set
  if (getGitHubToken()) pushToGitHub();
}

function copyManifest() {
  navigator.clipboard.writeText($('manifestOutput').value).then(function(){toast('清单已复制到剪贴板','success');});
}

function downloadManifest() {
  var blob = new Blob([$('manifestOutput').value],{type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'manifest.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('manifest.json 已下载','success');
}

function doImportManifest(input) {
  var file = input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var data = JSON.parse(e.target.result);
      if(!data.works) throw new Error('格式错误');
      var existing = {};
      for(var i=0;i<works.length;i++) existing[works[i].src] = true;
      var added=0;
      data.works.forEach(function(item){
        if(!existing[item.src]){
          addWork(item.src,item.title||'作品',item.tags||['photography']);
          added++;
        }
      });
      toast('导入完成 · '+added+' 张新作品','success');
    } catch(err){
      toast('清单格式错误，请检查 JSON 文件','error');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ─── SCROLL REVEAL ───
var revealObs = new IntersectionObserver(function(entries){
  entries.forEach(function(entry){
    if(entry.isIntersecting){
      entry.target.classList.add('reveal');
      revealObs.unobserve(entry.target);
    }
  });
},{threshold:0.1,rootMargin:'0px 0px -50px 0px'});

function revealCards() {
  document.querySelectorAll('.card:not(.reveal)').forEach(function(c){revealObs.observe(c);});
}

// ─── INIT ───
loadWorks();
