(function (window) {
function mount(){
 const launch=document.getElementById('modir-ai-launch'), panel=document.getElementById('modir-ai-panel');
 if(!launch||!panel)return;
 if(modirAiHistoryToken!==S.token){modirAiHistory=[];modirAiHistoryToken=S.token||'';}
 launch.style.display=S.token?'flex':'none';
  const faqBox=document.getElementById('modir-ai-faq');
  if(faqBox&&S.me?.is_admin){
   const managerFaqs=['شارژ ماهانه را چطور ثبت کنم؟','قبض آب یا گاز را چطور ثبت و تقسیم کنم؟','هزینه تعمیرات را چطور ثبت کنم؟','پرداخت ساکن را چطور تأیید کنم؟','درخواست‌های ساکنان را کجا بررسی کنم؟','چطور برای ساکنان اطلاعیه بفرستم؟','بدهی واحدها را چطور ببینم؟','مشخصات واحدها را چطور ویرایش کنم؟','اتصال ربات بله به گروه ساختمان چطور کار می‌کند؟'];
   faqBox.innerHTML=managerFaqs.map(q=>'<button type="button" data-faq="'+q+'" style="border:1px solid var(--border,#dfe2ec);border-radius:16px;background:var(--card,#fff);color:var(--text,#222);padding:7px 10px;font:11px Vazirmatn,sans-serif;cursor:pointer">'+q+'</button>').join('');
  }
  const savedPos=(()=>{try{return JSON.parse(localStorage.getItem('modir_ai_avatar_pos')||'null')}catch(_){return null}})();
  if(savedPos&&Number.isFinite(savedPos.x)&&Number.isFinite(savedPos.y)){launch.style.left=Math.max(4,Math.min(innerWidth-62,savedPos.x))+'px';launch.style.top=Math.max(4,Math.min(innerHeight-62,savedPos.y))+'px';launch.style.right='auto';}
  let dragState=null,dragged=false;
  const placePanel=()=>{if(!panel.classList.contains('open'))return;const r=launch.getBoundingClientRect(),w=panel.offsetWidth||Math.min(390,innerWidth-76),h=panel.offsetHeight||Math.min(560,innerHeight-36),gap=12;let left=r.left>innerWidth/2?r.left-w-gap:r.right+gap;left=Math.max(6,Math.min(innerWidth-w-6,left));let top=Math.max(6,Math.min(innerHeight-h-6,r.top+r.height/2-h/2));panel.style.left=left+'px';panel.style.right='auto';panel.style.top=top+'px';panel.style.transform='none';};
  launch.onpointerdown=e=>{if(e.button!==undefined&&e.button!==0)return;const r=launch.getBoundingClientRect();dragState={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top};dragged=false;launch.setPointerCapture?.(e.pointerId);};
  launch.onpointermove=e=>{if(!dragState||dragState.id!==e.pointerId)return;const dx=e.clientX-dragState.startX,dy=e.clientY-dragState.startY;if(Math.abs(dx)+Math.abs(dy)>5)dragged=true;if(!dragged)return;const x=Math.max(4,Math.min(innerWidth-launch.offsetWidth-4,dragState.left+dx)),y=Math.max(4,Math.min(innerHeight-launch.offsetHeight-4,dragState.top+dy));launch.style.left=x+'px';launch.style.top=y+'px';launch.style.right='auto';launch.classList.add('dragging');placePanel();};
  const finishDrag=e=>{if(!dragState||dragState.id!==e.pointerId)return;if(dragged){const r=launch.getBoundingClientRect();try{localStorage.setItem('modir_ai_avatar_pos',JSON.stringify({x:r.left,y:r.top}))}catch(_){}}launch.classList.remove('dragging');dragState=null;};
  launch.onpointerup=finishDrag;launch.onpointercancel=finishDrag;
  launch.onclick=()=>{if(dragged){dragged=false;return;}panel.classList.toggle('open');if(panel.classList.contains('open')){placePanel();document.getElementById('modir-ai-input')?.focus();}};
  window.__modirAiPlacePanel = placePanel;
  if (!window.__modirAiResizeHandler) {
    window.__modirAiResizeHandler = () => window.__modirAiPlacePanel?.();
    window.addEventListener('resize', window.__modirAiResizeHandler);
  }
 document.getElementById('modir-ai-close').onclick=()=>panel.classList.remove('open');
 const form=document.getElementById('modir-ai-compose');
 if(form.dataset.ready)return;form.dataset.ready='1';
 document.getElementById('modir-ai-faq')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-faq]');if(!b)return;
  const input=document.getElementById('modir-ai-input');input.value=b.dataset.faq;form.requestSubmit();
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(modirAiBusy||!S.token)return;
  const input=document.getElementById('modir-ai-input'),send=document.getElementById('modir-ai-send');
  const question=input.value.trim();if(!question)return;
  const box=document.getElementById('modir-ai-messages');
  const user=document.createElement('div');user.className='modir-ai-msg user';user.textContent=question;box.appendChild(user);input.value='';
  modirAiHistory.push({role:'user',text:question});
  modirAiBusy=true;send.disabled=true;send.textContent='...';
  const wait=document.createElement('div');wait.className='modir-ai-msg bot';wait.textContent='در حال بررسی سؤال شما...';box.appendChild(wait);box.scrollTop=box.scrollHeight;
  try{
   const response=await fetch(SUPABASE_URL+'/functions/v1/modir-assistant',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},body:JSON.stringify({token:S.token,question,today_ym:(TODAY.y*100+TODAY.m),history:modirAiHistory.slice(-12)})});
   const data=await response.json();if(!response.ok||!data.answer)throw new Error(data.error||'پاسخ‌گویی موقتاً امکان‌پذیر نیست.');
    wait.textContent=data.answer;
    const answerText=String(data.answer||'');
    const shortcuts=[
     {key:'announcements',label:'رفتن به اعلانات',re:/اعلان|اطلاعیه/},
     {key:'requests',label:S.me?.is_admin?'رفتن به درخواست‌ها':'ارتباط با مدیر',re:/درخواست|ارتباط با مدیر/},
     {key:'tx',label:'رفتن به تراکنش‌ها',re:/شارژ|قبض|بدهی|مانده حساب|پرداخت|تراکنش|رسید/},
     {key:'pay',label:'تأیید پرداخت‌ها',re:/تأیید پرداخت/,admin:true},
     {key:'settings',label:'تنظیمات',re:/تنظیمات|پروفایل|گزارش فعالیت/,admin:true},
     {key:'profile',label:'رفتن به پروفایل',re:/پروفایل|اطلاعات حساب/},
     {key:'units',label:'مدیریت واحدها',re:/مدیریت واحد|واحدها/,admin:true},
     {key:'services',label:'مشاهده خدمات',re:/منو|خدمات سامانه|بخش.?های سامانه/}
    ];
    const linkBox=document.createElement('div');linkBox.className='modir-ai-links';
    shortcuts.filter(s=>s.re.test(answerText)&&(!s.admin||S.me?.is_admin)).forEach(s=>{const a=document.createElement('a');a.href='#'+s.key;a.className='modir-ai-link';a.textContent='↗ '+s.label;a.addEventListener('click',ev=>{ev.preventDefault();panel.classList.remove('open');go(s.key);});linkBox.appendChild(a);});
    if(linkBox.childElementCount)wait.appendChild(linkBox);
   modirAiHistory.push({role:'model',text:data.answer});
   modirAiHistory=modirAiHistory.slice(-12);
  }catch(err){modirAiHistory.pop();wait.textContent=err.message||'ارتباط با دستیار برقرار نشد. دوباره تلاش کنید.';}
  finally{modirAiBusy=false;send.disabled=false;send.textContent='ارسال';input.focus();box.scrollTop=box.scrollHeight;}
 });
}

window.ModirAssistant = Object.freeze({ mount });
})(window);
