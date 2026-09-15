(function(){
  'use strict';
  var state={tab:'market',items:[],progress:{},isAdmin:false,loading:false,requestId:'',offset:0,detailItem:null,detailVersions:[],academyDetail:null,playback:{lessonId:'',lastSavedAt:0,saving:false,pending:null}};
  var marketTypes=['annual_report','monthly_report','whitepaper','policy_guide','data_summary'];
  var aiTypes=['ai_agent','external_tool'];
  var academyTypes=['course','lesson','course_material'];
  var typeLabels={annual_report:'年度报告',monthly_report:'月报',whitepaper:'白皮书',policy_guide:'政策解读',data_summary:'数据汇总',ai_agent:'AI 智能体',external_tool:'外部工具',course:'课程',lesson:'课程单元',course_material:'课程资料'};
  var tabLabels={market:'市场资料库',ai:'AI 智能体中心',academy:'观海学院'};
  var demoItems=[
    {id:'demo-market-summary',slug:'demo-market-summary',title:'跨境市场年度数据汇总',summary:'按国家、平台和品类汇总的正式市场指标与政策索引。',resource_type:'data_summary',resource_year:2025,status:'published',access_level:'public',source_kind:'internal',metadata:{route:'',demo:true}},
    {id:'demo-ai-market',slug:'ai-market-analyst',title:'市场分析助手',summary:'基于正式历史投影回答市场、平台和政策问题。',resource_type:'ai_agent',status:'published',access_level:'public',source_kind:'internal',metadata:{route:'overview',agent_key:'market_analyst',provider:'deepseek'}},
    {id:'demo-ai-report',slug:'ai-report-generator',title:'报告生成助手',summary:'按已核验数据和来源附录生成市场决策报告。',resource_type:'ai_agent',status:'published',access_level:'public',source_kind:'internal',metadata:{route:'report',agent_key:'report_generator',provider:'deepseek'}},
    {id:'demo-tool-profit',slug:'internal-profit-calculator',title:'利润测算工具',summary:'使用当前工作区输入数据进行单件利润、费用和敏感性测算。',resource_type:'external_tool',status:'published',access_level:'public',source_kind:'internal',metadata:{route:'tools'}},
    {id:'demo-academy',slug:'guanhai-academy',title:'观海学院',summary:'跨境经营课程、学习进度和配套资料入口。',resource_type:'course',status:'published',access_level:'public',source_kind:'internal',metadata:{route:'academy',status:'content_pending'}}
  ];
  var demoAcademy={course:{id:'demo-course-short-video',title:'短视频操盘手',description:'从定位、选题、脚本、拍摄到投放复盘的完整短视频运营课程。',instructor:'观海学院',version_no:1,enrolled:true,favorite:false},modules:[
    {id:'demo-module-1',title:'模块一：账号定位与内容策略',summary:'建立目标人群、账号定位和内容支柱。',sort_order:10,lessons:[
      {id:'demo-lesson-1',title:'目标用户与账号定位',summary:'明确账号服务对象和内容边界。',lesson_type:'article',duration_seconds:1200,progress:{progress_percent:0,status:'not_started'}},
      {id:'demo-lesson-2',title:'内容支柱与选题库',summary:'建立长期可维护的选题和栏目结构。',lesson_type:'article',duration_seconds:1500,progress:{progress_percent:0,status:'not_started'}}
    ]},
    {id:'demo-module-2',title:'模块二：脚本与拍摄执行',summary:'把选题转成可拍摄、可复用的短视频脚本。',sort_order:20,lessons:[
      {id:'demo-lesson-3',title:'短视频脚本拆解',summary:'掌握开场、信息密度和行动引导。',lesson_type:'video',duration_seconds:1800,progress:{progress_percent:0,status:'not_started'}},
      {id:'demo-lesson-4',title:'拍摄与剪辑工作流',summary:'从素材采集到发布前检查的标准流程。',lesson_type:'video',duration_seconds:2100,progress:{progress_percent:0,status:'not_started'}}
    ]},
    {id:'demo-module-3',title:'模块三：发布、投放与复盘',summary:'理解分发、投放指标和迭代复盘方法。',sort_order:30,lessons:[
      {id:'demo-lesson-5',title:'平台发布与合规检查',summary:'发布前确认平台规则、版权和广告标识。',lesson_type:'article',duration_seconds:1500,progress:{progress_percent:0,status:'not_started'}},
      {id:'demo-lesson-6',title:'数据复盘与下一轮计划',summary:'用播放、互动和转化指标推动迭代。',lesson_type:'video',duration_seconds:2400,progress:{progress_percent:0,status:'not_started'}}
    ]}
  ]};
  function $(id){return document.getElementById(id);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function isDemo(){return typeof jayIsDemo==='boolean'?jayIsDemo:(typeof window.jayIsDemo==='boolean'?window.jayIsDemo:false);}
  function workspaceId(){return typeof jayActiveWorkspaceId==='function'?jayActiveWorkspaceId():null;}
  function call(action,body){
    body=body||{};body.action=action;if(workspaceId())body.workspace_id=workspaceId();
    return jayFunctionRequest('resource-library',body,{timeout:30000,retryOnNetwork:true,requestId:'resource-library:'+action+':'+Date.now()});
  }
  async function validateUpload(file,kind){
    if(!file||typeof jaySecurityGate!=='function')return;
    var bytes=new Uint8Array(await file.slice(0,64).arrayBuffer()),binary='';
    bytes.forEach(function(value){binary+=String.fromCharCode(value);});
    await jaySecurityGate('upload',{file:{name:file.name,size_bytes:file.size,mime_type:file.type||'application/octet-stream',kind:kind,head_base64:btoa(binary)}});
  }
  function tabTypes(){return state.tab==='ai'?aiTypes:(state.tab==='academy'?academyTypes:marketTypes);}
  function setText(id,value){var node=$(id);if(node)node.textContent=String(value==null?'':value);}
  function setStatus(value){setText('resource-page-status',value);}
  function resourceMarketOptions(){
    var select=$('resource-market-filter');if(!select||select.dataset.ready)return;
    var markets=[];var api=window.JAY_MARKET_SCOPE_API;
    if(api&&api.getConfig){markets=(api.getConfig().markets||[]).filter(function(item){return item&&item.status!=='inactive';});}
    markets.forEach(function(item){var option=document.createElement('option');option.value=String(item.code||'').toUpperCase();option.textContent=(item.name||item.label||item.code)+'（'+item.code+'）';select.appendChild(option);});
    select.dataset.ready='1';
  }
  function resourcePlatformOptions(){
    var select=$('resource-platform-filter');if(!select||select.dataset.ready)return;
    var platforms=[];var api=window.JAY_MARKET_SCOPE_API;
    if(api&&api.getConfig)platforms=api.getConfig().platforms||[];
    else if(api&&api.getActivePlatforms)platforms=api.getActivePlatforms();
    platforms=platforms.filter(function(item){return item&&item.key;});
    platforms.forEach(function(item){var option=document.createElement('option');option.value=String(item.key).toLowerCase();option.textContent=item.name||item.key;select.appendChild(option);});
    select.dataset.ready='1';
  }
  function filters(){
    return {query:$('resource-query')&&$('resource-query').value.trim()||'',resource_type:$('resource-type-filter')&&$('resource-type-filter').value||'',year:$('resource-year-filter')&&$('resource-year-filter').value||'',market_code:$('resource-market-filter')&&$('resource-market-filter').value||'',platform_key:$('resource-platform-filter')&&$('resource-platform-filter').value||''};
  }
  function visibleForTab(item){return tabTypes().indexOf(String(item.resource_type||''))>=0;}
  function formatSize(bytes){var n=Number(bytes||0);if(!n)return '';if(n<1024)return n+' B';if(n<1024*1024)return (n/1024).toFixed(1)+' KB';return (n/1024/1024).toFixed(1)+' MB';}
  function sourceLabel(kind){return ({official:'官方来源',licensed:'授权资料',internal:'系统资料',user_upload:'工作区上传',third_party:'第三方来源'})[kind]||'来源待核验';}
  function card(item){
    var metadata=item.metadata&&typeof item.metadata==='object'?item.metadata:{};
    var route=String(metadata.route||'');
    var button=route&&route!=='academy'?'<button type="button" class="resource-card-action resource-route" data-route="'+esc(route)+'">打开入口</button>':(route==='academy'&&state.tab!=='academy'?'<button type="button" class="resource-card-action resource-route" data-route="academy">进入学院</button>':'<button type="button" class="resource-card-action resource-detail-open">查看课程</button>');
    var progress=state.progress[item.id],progressPercent=progress?Math.max(0,Math.min(100,Number(progress.progress_percent)||0)):0;
    var learning=state.tab==='academy'?'<div class="resource-progress"><div class="resource-progress-head"><span>学习进度</span><b>'+progressPercent+'%</b></div><div class="resource-progress-track"><i style="width:'+progressPercent+'%"></i></div><button type="button" class="resource-card-action resource-progress-toggle" data-progress="'+(progressPercent>=100?'reset':'complete')+'">'+(progressPercent>=100?'重新学习':'标记完成')+'</button></div>':'';
    var admin=state.isAdmin?'<button type="button" class="resource-card-action resource-edit">编辑</button><button type="button" class="resource-card-action resource-'+(item.status==='published'?'archive':'publish')+'">'+(item.status==='published'?'下架':'发布')+'</button>':'';
    var status=item.status==='published'?'已发布':(item.status==='archived'?'已归档':'草稿');
    return '<article class="resource-card" data-resource-id="'+esc(item.id)+'"><div class="resource-card-top"><span class="resource-type">'+esc(typeLabels[item.resource_type]||item.resource_type||'资源')+'</span><span class="resource-status '+esc(item.status||'draft')+'">'+status+'</span></div><h4>'+esc(item.title||'未命名资源')+'</h4><p>'+esc(item.summary||'暂无摘要')+'</p><div class="resource-card-meta"><span>'+esc(sourceLabel(item.source_kind))+'</span>'+(item.resource_year?'<span>'+esc(item.resource_year)+' 年</span>':'')+(item.market_code?'<span>'+esc(item.market_code)+'</span>':'')+'</div>'+learning+'<div class="resource-card-actions">'+button+(item.access_level==='public'?'':'<span class="resource-lock"><i data-lucide="lock"></i>'+esc(item.access_level==='workspace'?'工作区':'受限')+'</span>')+admin+'</div></article>';
  }
  function render(){
    var list=$('resource-list'),empty=$('resource-empty');if(!list)return;
    var rows=state.items.filter(visibleForTab);var f=filters();
    if(f.query){var query=f.query.toLowerCase();rows=rows.filter(function(item){return [item.title,item.summary,item.slug,item.platform_key,item.market_code,JSON.stringify(item.metadata||{})].join(' ').toLowerCase().indexOf(query)>=0;});}
    if(f.resource_type)rows=rows.filter(function(item){return item.resource_type===f.resource_type;});
    if(f.year)rows=rows.filter(function(item){return String(item.resource_year||'')===String(f.year);});
    if(f.market_code)rows=rows.filter(function(item){return String(item.market_code||'').toUpperCase()===String(f.market_code).toUpperCase();});
    if(f.platform_key)rows=rows.filter(function(item){return String(item.platform_key||'').toLowerCase()===String(f.platform_key).toLowerCase();});
    if(!rows.length){list.innerHTML='';if(empty)empty.hidden=false;setText('resource-result-count','0 条资源');return;}
    if(empty)empty.hidden=true;list.innerHTML=rows.map(card).join('');setText('resource-result-count',rows.length+' 条资源');
    if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();
  }
  function renderSeeds(){state.items=demoItems.slice();state.progress={};state.isAdmin=false;var adminOpen=$('resource-admin-open');if(adminOpen)adminOpen.hidden=true;setStatus('演示目录 · 登录后可访问工作区资源和受限文件');render();}
  async function load(){
    if(state.loading)return;state.loading=true;resourceMarketOptions();resourcePlatformOptions();setStatus('正在读取资源目录…');
    if(isDemo()){renderSeeds();state.loading=false;return;}
    try{var result=await call('list',filters());state.items=Array.isArray(result.items)?result.items:[];state.isAdmin=result.is_admin===true;state.progress={};if(state.tab==='academy'){var progressResult=await call('progress_list',{});(Array.isArray(progressResult.progress)?progressResult.progress:[]).forEach(function(entry){state.progress[entry.resource_item_id]=entry;});}setStatus(state.isAdmin?'管理员资源台 · 文件通过短期签名链接访问':'正式资源目录 · 文件通过短期签名链接访问');var adminOpen=$('resource-admin-open');if(adminOpen)adminOpen.hidden=!state.isAdmin;render();}
    catch(error){state.items=[];setStatus('资源目录暂时不可用：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));render();}
    finally{state.loading=false;}
  }
  function openEditor(item){
    var panel=$('resource-admin-panel');if(!panel)return;panel.hidden=false;setText('resource-admin-title',item?'编辑资源':'新增资源');
    $('resource-edit-id').value=item&&item.id||'';$('resource-edit-title').value=item&&item.title||'';$('resource-edit-slug').value=item&&item.slug||'';$('resource-edit-type').value=item&&item.resource_type||'annual_report';$('resource-edit-status').value=item&&item.status||'draft';$('resource-edit-access').value=item&&item.access_level||'public';$('resource-edit-source-kind').value=item&&item.source_kind||'internal';$('resource-edit-year').value=item&&item.resource_year||'';$('resource-edit-market').value=item&&item.market_code||'';$('resource-edit-platform').value=item&&item.platform_key||'';$('resource-edit-summary').value=item&&item.summary||'';$('resource-edit-source').value=item&&item.source_url||'';$('resource-edit-file').value='';setText('resource-admin-feedback','');panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeEditor(){var panel=$('resource-admin-panel');if(panel)panel.hidden=true;}
  function openVersionEditor(item,versions){
    if(!state.isAdmin||!item)return;
    var panel=$('resource-version-panel');if(!panel)return;
    var latest=(versions||[]).reduce(function(max,version){return Math.max(max,Number(version.version_no)||0);},0);
    panel.hidden=false;
    $('resource-version-item-id').value=item.id||'';
    $('resource-version-no').value=String(latest+1||1);
    $('resource-version-title').value=item.title||'';
    $('resource-version-published').value=new Date().toISOString().slice(0,10);
    $('resource-version-source-record').value='';
    $('resource-version-summary').value=item.summary||'';
    $('resource-version-source').value=item.source_url||'';
    $('resource-version-change-note').value='';
    $('resource-version-file').value='';
    setText('resource-version-context','为“'+(item.title||'当前资源')+'”保留新的历史版本。旧版本不会被覆盖。');
    setText('resource-version-feedback','');
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeVersionEditor(){var panel=$('resource-version-panel');if(panel)panel.hidden=true;}
  async function saveItem(event){
    event.preventDefault();var feedback=$('resource-admin-feedback'),button=$('resource-admin-save');if(button)button.disabled=true;setText('resource-admin-feedback','正在保存…');
    var body={resource_item_id:$('resource-edit-id').value||null,title:$('resource-edit-title').value,slug:$('resource-edit-slug').value,resource_type:$('resource-edit-type').value,status:$('resource-edit-status').value,access_level:$('resource-edit-access').value,source_kind:$('resource-edit-source-kind').value,resource_year:$('resource-edit-year').value,market_code:$('resource-edit-market').value,platform_key:$('resource-edit-platform').value,summary:$('resource-edit-summary').value,source_url:$('resource-edit-source').value};
    try{var result=await call('save_item',body);var item=result&&result.item;if(!item)throw new Error('RESOURCE_ITEM_SAVE_FAILED');var fileInput=$('resource-edit-file'),file=fileInput&&fileInput.files&&fileInput.files[0];if(file){if(!window.supabaseClient||!supabaseClient.storage)throw new Error('RESOURCE_STORAGE_NOT_READY');await validateUpload(file,'resource');var plan=await call('prepare_upload',{resource_item_id:item.id,file_format:(file.name.split('.').pop()||'bin')});var uploaded=await supabaseClient.storage.from('resources').upload(plan.storage_path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(uploaded.error)throw uploaded.error;await call('register_file',{resource_item_id:item.id,storage_path:plan.storage_path,file_format:(file.name.split('.').pop()||'bin'),mime_type:file.type||'application/octet-stream',size_bytes:file.size});}setText('resource-admin-feedback','已保存');closeEditor();await load();}
    catch(error){setText('resource-admin-feedback','保存失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
    finally{if(button)button.disabled=false;}
  }
  async function saveVersion(event){
    event.preventDefault();
    var button=$('resource-version-save');if(button)button.disabled=true;
    setText('resource-version-feedback','正在保存版本…');
    var itemId=$('resource-version-item-id').value;
    var body={resource_item_id:itemId,version_no:$('resource-version-no').value,title:$('resource-version-title').value,summary:$('resource-version-summary').value,source_url:$('resource-version-source').value,source_record_id:$('resource-version-source-record').value,published_at:$('resource-version-published').value?new Date($('resource-version-published').value+'T00:00:00Z').toISOString():null,change_note:$('resource-version-change-note').value};
    try{
      var result=await call('create_version',body),version=result&&result.version;
      if(!version)throw new Error('RESOURCE_VERSION_SAVE_FAILED');
      var fileInput=$('resource-version-file'),file=fileInput&&fileInput.files&&fileInput.files[0];
      if(file){
        if(!window.supabaseClient||!supabaseClient.storage)throw new Error('RESOURCE_STORAGE_NOT_READY');
        await validateUpload(file,'resource');
        var plan=await call('prepare_upload',{resource_item_id:itemId,resource_version_id:version.id,file_format:(file.name.split('.').pop()||'bin')});
        var uploaded=await supabaseClient.storage.from('resources').upload(plan.storage_path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
        if(uploaded.error)throw uploaded.error;
        var registered=await call('register_file',{resource_item_id:itemId,resource_version_id:version.id,storage_path:plan.storage_path,file_format:(file.name.split('.').pop()||'bin'),mime_type:file.type||'application/octet-stream',size_bytes:file.size});
        if(!registered||!registered.file)throw new Error('RESOURCE_FILE_REGISTER_FAILED');
      }
      if(state.academyDetail&&state.academyDetail.course&&state.detailItem&&state.detailItem.resource_type==='course')await call('academy_publish_version',{course_id:state.academyDetail.course.id,resource_item_id:itemId,version_no:version.version_no});
      setText('resource-version-feedback','版本已保存');
      closeVersionEditor();
      await openDetail(itemId);
    }catch(error){setText('resource-version-feedback','版本保存失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
    finally{if(button)button.disabled=false;}
  }
  function academyDuration(seconds){var value=Math.max(0,Number(seconds)||0);if(!value)return '时长待补充';var minutes=Math.round(value/60);return minutes<60?minutes+' 分钟':Math.floor(minutes/60)+' 小时 '+(minutes%60)+' 分钟';}
  function academyOutline(data){
    if(!data||!data.course)return '';
    var course=data.course,favoriteLabel=course.favorite?'取消收藏':'收藏课程',enrollLabel=course.enrolled?'已加入课程':'加入课程';
    var modules=Array.isArray(data.modules)?data.modules:[];
    var moduleHtml=modules.map(function(module,moduleIndex){
      var lessons=Array.isArray(module.lessons)?module.lessons:[];
      var orderButtons=state.isAdmin?'<button type="button" class="icon-btn academy-module-up" data-index="'+moduleIndex+'" title="上移章节"><i data-lucide="chevron-up"></i></button><button type="button" class="icon-btn academy-module-down" data-index="'+moduleIndex+'" title="下移章节"><i data-lucide="chevron-down"></i></button>':'';
      var lessonHtml=lessons.map(function(lesson,lessonIndex){
        var progress=lesson.progress||{},percent=Math.max(0,Math.min(100,Number(progress.progress_percent)||0)),action=percent>=100?'重新学习':(percent>0?'继续学习':'开始学习');
        var videoUpload=state.isAdmin&&lesson.lesson_type==='video'?'<label class="academy-video-upload"><input type="file" accept="video/mp4,video/webm,video/quicktime" data-lesson-video="'+esc(lesson.id)+'" data-course-id="'+esc(course.id)+'"><span>上传视频</span></label>':'';
        var materialUpload=state.isAdmin?'<label class="academy-material-upload"><input type="file" accept=".pdf,.docx,.xlsx,.csv,.md,.txt,.zip" data-lesson-resource="'+esc(lesson.id)+'" data-course-id="'+esc(course.id)+'"><span>上传课件</span></label>':'';
        var resources=Array.isArray(lesson.resources)?lesson.resources:[];
        var resourceButtons=resources.length?'<div class="academy-lesson-resources">'+resources.map(function(file){return '<button type="button" class="resource-card-action academy-resource-download" data-lesson-id="'+esc(lesson.id)+'" data-file-id="'+esc(file.id)+'"><i data-lucide="paperclip"></i>'+esc(String(file.file_format||'课件').toUpperCase())+' '+esc(formatSize(file.size_bytes))+'</button>';}).join('')+'</div>':'';
        var lessonOrder=state.isAdmin?'<button type="button" class="icon-btn academy-lesson-up" data-module-id="'+esc(module.id)+'" data-index="'+lessonIndex+'" title="上移课时"><i data-lucide="chevron-up"></i></button><button type="button" class="icon-btn academy-lesson-down" data-module-id="'+esc(module.id)+'" data-index="'+lessonIndex+'" title="下移课时"><i data-lucide="chevron-down"></i></button>':'';
        return '<article class="academy-lesson" data-lesson-id="'+esc(lesson.id)+'"><div class="academy-lesson-main"><span class="academy-lesson-type">'+esc(lesson.lesson_type==='video'?'视频':(lesson.lesson_type==='article'?'文章':'资料'))+'</span><div><strong>'+esc(lesson.title)+'</strong><p>'+esc(lesson.summary||'')+'</p></div></div>'+resourceButtons+'<div class="academy-lesson-meta"><span>'+esc(academyDuration(lesson.duration_seconds))+'</span><span>'+percent+'%</span><div class="academy-lesson-progress-track"><i style="width:'+percent+'%"></i></div><button type="button" class="st-btn st-btn-outline academy-lesson-progress" data-lesson-id="'+esc(lesson.id)+'" data-progress-action="'+(percent>=100?'reset':'complete')+'">'+action+'</button>'+(lesson.lesson_type==='video'?'<button type="button" class="st-btn st-btn-outline academy-lesson-play" data-lesson-id="'+esc(lesson.id)+'"><i data-lucide="play"></i>播放</button>':'')+videoUpload+materialUpload+lessonOrder+'</div></article>';
      }).join('');
      return '<div class="academy-module" data-module-id="'+esc(module.id)+'"><div class="academy-module-head"><div><strong>第 '+(moduleIndex+1)+' 章 · '+esc(module.title)+'</strong><p>'+esc(module.summary||'')+'</p></div><div class="academy-order-actions">'+orderButtons+'</div></div><div class="academy-lesson-list">'+(lessonHtml||'<p class="academy-empty">本章还没有发布课时。</p>')+'</div></div>';
    }).join('');
    return '<section class="academy-outline"><div class="academy-course-actions"><span class="academy-enrollment-state">'+esc(enrollLabel)+'</span><button type="button" class="st-btn st-btn-outline academy-enroll" data-course-id="'+esc(course.id)+'"'+(course.enrolled?' disabled':'')+'>'+esc(enrollLabel)+'</button><button type="button" class="st-btn st-btn-outline academy-favorite" data-course-id="'+esc(course.id)+'" data-favorite="'+(course.favorite?'true':'false')+'"><i data-lucide="bookmark"></i>'+favoriteLabel+'</button></div>'+(moduleHtml||'<p class="academy-empty">课程章节正在准备中。</p>')+'</section>';
  }
  function academyDemoData(){return JSON.parse(JSON.stringify(demoAcademy));}
  async function academyProgress(lessonId,action){
    if(isDemo()){var data=state.academyDetail||academyDemoData();data.modules.forEach(function(module){(module.lessons||[]).forEach(function(lesson){if(String(lesson.id)===String(lessonId)){lesson.progress=action==='reset'?{progress_percent:0,status:'not_started'}:{progress_percent:100,status:'completed'};}});});state.academyDetail=data;state.detailItem=state.detailItem||{id:'demo-academy'};renderAcademyDetail(data);return;}
    try{await call('lesson_progress_update',{lesson_id:lessonId,status:action==='reset'?'not_started':'completed',progress_percent:action==='reset'?0:100});if(state.detailItem)await openDetail(state.detailItem.id);}catch(error){setStatus('课时进度保存失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
  }
  async function enrollCourse(courseId){try{if(isDemo()){setStatus('演示课程已加入当前页面');return;}await call('enroll_course',{course_id:courseId});if(state.detailItem)await openDetail(state.detailItem.id);}catch(error){setStatus('加入课程失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}}
  async function toggleFavorite(courseId,currentlyFavorite){try{if(isDemo()){if(state.academyDetail)state.academyDetail.course.favorite=!currentlyFavorite;renderAcademyDetail(state.academyDetail);return;}var result=await call('academy_favorite',{course_id:courseId,mode:currentlyFavorite?'remove':'add'});if(state.academyDetail)state.academyDetail.course.favorite=result.favorite===true;renderAcademyDetail(state.academyDetail);}catch(error){setStatus('收藏状态保存失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}}
  function academyFindLesson(lessonId){var found=null;(state.academyDetail&&state.academyDetail.modules||[]).some(function(module){return (module.lessons||[]).some(function(lesson){if(String(lesson.id)!==String(lessonId))return false;found=lesson;return true;});});return found;}
  function academyTime(seconds){var value=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');}
  function updateAcademyLessonProgress(lessonId,progress){var lesson=academyFindLesson(lessonId);if(lesson)lesson.progress=Object.assign({},lesson.progress||{},progress||{});}
  async function persistLessonPlayback(snapshot){
    if(isDemo()||!snapshot||!snapshot.lessonId)return;
    if(state.playback.saving){state.playback.pending=snapshot;return;}
    state.playback.saving=true;
    var current=snapshot;
    try{
      while(current){
        state.playback.pending=null;
        var result=await call('lesson_progress_update',{lesson_id:current.lessonId,status:current.completed?'completed':(current.percent>0?'in_progress':'not_started'),progress_percent:current.completed?100:current.percent,last_position_seconds:current.completed?0:current.position,watched_seconds:current.watched});
        if(result&&result.progress)updateAcademyLessonProgress(current.lessonId,result.progress);
        current=state.playback.pending;
      }
    }catch(error){setStatus('播放进度同步失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
    finally{state.playback.saving=false;}
  }
  function captureLessonPlayback(video,lessonId,force,completed){
    var now=Date.now();if(!force&&now-state.playback.lastSavedAt<10000)return;
    var duration=Math.max(0,Number(video.duration)||0),position=Math.max(0,Number(video.currentTime)||0),lesson=academyFindLesson(lessonId),previous=lesson&&lesson.progress||{};
    var percent=duration?Math.max(0,Math.min(99,Math.round(position/duration*100))):Math.max(0,Math.min(99,Number(previous.progress_percent)||0));
    state.playback.lastSavedAt=now;
    persistLessonPlayback({lessonId:lessonId,position:Math.round(position),watched:Math.max(Math.round(position),Number(previous.watched_seconds)||0),percent:percent,completed:completed===true});
  }
  function closeAcademyPlayer(){var player=$('academy-player'),video=$('academy-video-player');if(video){if(state.playback.lessonId)captureLessonPlayback(video,state.playback.lessonId,true,video.ended);video.onpause=null;video.ontimeupdate=null;video.onended=null;video.onerror=null;video.pause();video.removeAttribute('src');video.load();}if(player)player.hidden=true;state.playback.lessonId='';}
  async function playLesson(lessonId){
    try{
      if(isDemo()){setStatus('演示课程尚未配置视频媒体');return;}
      var player=$('academy-player'),video=$('academy-video-player'),lesson=academyFindLesson(lessonId);if(!player||!video||!lesson)throw new Error('LESSON_PLAYER_NOT_READY');
      setStatus('正在签发课程播放地址…');
      var result=await call('lesson_playback',{lesson_id:lessonId}),playbackUrl=result&&typeof jaySafeHttpsUrl==='function'?jaySafeHttpsUrl(result.playback_url):'';
      if(!playbackUrl)throw new Error('LESSON_PLAYBACK_URL_MISSING');
      state.playback.lessonId=lessonId;state.playback.lastSavedAt=0;state.playback.pending=null;
      setText('academy-player-title',lesson.title||'课程视频');setText('academy-player-status','播放进度将自动同步');player.hidden=false;
      video.onloadedmetadata=function(){var resumeAt=Math.max(0,Number(lesson.progress&&lesson.progress.last_position_seconds)||0);if(resumeAt>0&&resumeAt<Math.max(0,video.duration-2)){video.currentTime=resumeAt;setText('academy-player-status','已恢复到 '+academyTime(resumeAt));}video.play().catch(function(){});};
      video.ontimeupdate=function(){captureLessonPlayback(video,lessonId,false,false);};
      video.onpause=function(){if(state.playback.lessonId===lessonId&&!video.ended)captureLessonPlayback(video,lessonId,true,false);};
      video.onended=function(){captureLessonPlayback(video,lessonId,true,true);setText('academy-player-status','本课时已完成并同步');};
      video.onerror=function(){setStatus('视频加载失败，请重新获取播放地址');};
      video.src=playbackUrl;video.load();player.scrollIntoView({behavior:'smooth',block:'nearest'});setStatus('课程视频已就绪');
    }catch(error){setStatus('视频播放失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
  }
  async function downloadLessonResource(lessonId,fileId){try{if(isDemo()){setStatus('演示课程没有可下载课件');return;}var result=await call('lesson_resource_download',{lesson_id:lessonId,resource_file_id:fileId});if(result&&result.file_url)window.open(result.file_url,'_blank','noopener');else throw new Error('LESSON_RESOURCE_URL_MISSING');}catch(error){setStatus('课件下载失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}}
  async function uploadLessonVideo(lessonId,courseId,file){
    if(!state.isAdmin||!file)return;
    try{if(!window.supabaseClient||!supabaseClient.storage)throw new Error('RESOURCE_STORAGE_NOT_READY');await validateUpload(file,'course_video');var format=(file.name.split('.').pop()||'mp4').toLowerCase();var plan=await call('prepare_video_upload',{lesson_id:lessonId,course_id:courseId,file_format:format});var uploaded=await supabaseClient.storage.from('academy-media').upload(plan.storage_path,file,{upsert:false,contentType:file.type||'video/mp4'});if(uploaded.error)throw uploaded.error;await call('register_video',{lesson_id:lessonId,course_id:courseId,storage_path:plan.storage_path,file_format:format,mime_type:file.type||'video/mp4',size_bytes:file.size});setStatus('视频已上传，播放地址将按权限临时签发');if(state.detailItem)await openDetail(state.detailItem.id);}catch(error){setStatus('视频上传失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
  }
  async function uploadLessonResource(lessonId,courseId,file){
    if(!state.isAdmin||!file)return;
    try{if(!window.supabaseClient||!supabaseClient.storage)throw new Error('RESOURCE_STORAGE_NOT_READY');await validateUpload(file,'course_material');var format=(file.name.split('.').pop()||'bin').toLowerCase();var plan=await call('prepare_lesson_resource_upload',{lesson_id:lessonId,course_id:courseId,file_format:format});if(file.size>Number(plan.max_size_bytes||52428800))throw new Error('RESOURCE_FILE_TOO_LARGE');var uploaded=await supabaseClient.storage.from('resources').upload(plan.storage_path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(uploaded.error)throw uploaded.error;await call('register_lesson_resource',{lesson_id:lessonId,course_id:courseId,storage_path:plan.storage_path,file_format:format,mime_type:file.type||'application/octet-stream',size_bytes:file.size});setStatus('课件已上传，学员下载时将重新校验课程权限');if(state.detailItem)await openDetail(state.detailItem.id);}catch(error){setStatus('课件上传失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
  }
  async function askCourseQuestion(event){
    event.preventDefault();var input=$('academy-question'),answer=$('academy-answer'),button=$('academy-question-submit');if(!input||!answer||!state.academyDetail)return;var question=input.value.trim();if(!question)return;if(isDemo()){answer.textContent='演示模式不调用第三方 AI。登录并获得课程权限后，可由课程智能体仅基于已授权课时回答。';return;}if(typeof callAI!=='function'){answer.textContent='课程问答服务尚未加载';return;}if(button)button.disabled=true;answer.textContent='课程智能体正在检索已授权课时…';try{var course=state.academyDetail.course;var result=await callAI('你是观海学院课程助教。只根据服务端注入的已授权课程内容回答，并保留课程引用编号。',question,{operation:'course.qa',entryPoint:'academy.course',taskType:'course_qa',agentKey:'course_assistant',provider:'auto',search:false,retrievalMode:'disabled',context:{course_id:course.id},dataDisclosureScope:['course_materials','request_context'],timeout:60000,max_tokens:1800});answer.textContent=result;}catch(error){answer.textContent='课程问答失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试');}finally{if(button)button.disabled=false;}
  }
  async function reorderAcademy(kind,moduleId,index,direction){
    if(!state.isAdmin||!state.academyDetail)return;
    var modules=state.academyDetail.modules||[];
    if(kind==='module'){var next=index+direction;if(next<0||next>=modules.length)return;var moved=modules.splice(index,1)[0];modules.splice(next,0,moved);await call('academy_reorder',{modules:modules.map(function(item){return {id:item.id};})});}
    else{var module=modules.find(function(item){return String(item.id)===String(moduleId);});if(!module)return;var lessons=module.lessons||[],lessonNext=index+direction;if(lessonNext<0||lessonNext>=lessons.length)return;var lesson=lessons.splice(index,1)[0];lessons.splice(lessonNext,0,lesson);await call('academy_reorder',{lessons:lessons.map(function(item){return {id:item.id};})});}
    await openDetail(state.detailItem.id);
  }
  function renderAcademyDetail(data){var detail=$('resource-detail');if(!detail||!data||!data.course)return;state.academyDetail=data;var course=data.course;var versionButton=state.isAdmin?'<button type="button" class="st-btn st-btn-outline resource-version-new"><i data-lucide="git-branch"></i>新建版本</button>':'';detail.innerHTML='<div class="resource-detail-head"><div><span class="section-label">GUANHAI ACADEMY</span><h3>'+esc(course.title)+'</h3><p>'+esc(course.description||'')+'</p><small class="academy-instructor">讲师：'+esc(course.instructor||'观海学院')+' · 版本 v'+esc(course.version_no||1)+'</small></div><div class="resource-detail-actions">'+versionButton+'<button type="button" class="icon-btn resource-detail-close" title="关闭详情"><i data-lucide="x"></i></button></div></div>'+academyOutline(data)+'<section id="academy-player" class="academy-player" hidden><div class="academy-player-head"><div><strong id="academy-player-title">课程视频</strong><span id="academy-player-status">播放进度将自动同步</span></div><button type="button" class="icon-btn academy-player-close" title="关闭播放器"><i data-lucide="x"></i></button></div><video id="academy-video-player" controls playsinline preload="metadata"></video></section><section class="academy-qa"><div><strong>课程问答</strong><p>只检索当前账号已授权的《'+esc(course.title)+'》课程内容。</p></div><form id="academy-question-form"><textarea id="academy-question" rows="2" maxlength="1200" placeholder="输入课程相关问题" required></textarea><button id="academy-question-submit" type="submit" class="st-btn st-btn-primary"><i data-lucide="message-square"></i>提问</button></form><div id="academy-answer" class="academy-answer" aria-live="polite"></div></section>';if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();var questionForm=$('academy-question-form');if(questionForm)questionForm.addEventListener('submit',askCourseQuestion);}
  async function openDetail(itemId){
    var detail=$('resource-detail');if(!detail)return;
    detail.hidden=false;detail.innerHTML='<div class="resource-detail-loading">正在读取版本和文件…</div>';
    if(isDemo()){
      var demoItem=state.items.find(function(item){return String(item.id)===String(itemId);});
      if(demoItem&&demoItem.resource_type==='course'){state.detailItem=demoItem;state.detailVersions=[];renderAcademyDetail(academyDemoData());return;}
    }
    try{
      var result=await call('detail',{resource_item_id:itemId}),item=result.item||{},versions=result.versions||[],files=result.files||[];
      state.detailItem=item;state.detailVersions=versions;
      if(item.resource_type==='course'){
        var academy=isDemo()?academyDemoData():await call('academy_detail',{resource_item_id:itemId});
        renderAcademyDetail(academy);
        return;
      }
      var versionButton=state.isAdmin?'<button type="button" class="st-btn st-btn-outline resource-version-new"><i data-lucide="git-branch"></i>新建版本</button>':'';
      var versionHtml=versions.length?versions.map(function(version){return '<div><strong>v'+esc(version.version_no)+'</strong><span>'+esc(version.title||item.title)+'</span><small>'+esc(version.change_note||'')+' · '+esc(version.published_at||version.created_at||'')+'</small></div>';}).join(''):'<p>暂无版本记录</p>';
      var fileHtml=files.length?files.map(function(file){return '<div><span><b>'+esc(String(file.file_format||'文件').toUpperCase())+'</b> '+esc(formatSize(file.size_bytes))+'</span><button type="button" class="st-btn st-btn-outline resource-download" data-file-id="'+esc(file.id)+'"><i data-lucide="download"></i>安全下载</button></div>';}).join(''):'<p>暂无可下载文件</p>';
      detail.innerHTML='<div class="resource-detail-head"><div><span class="section-label">RESOURCE DETAIL</span><h3>'+esc(item.title)+'</h3><p>'+esc(item.summary||'')+'</p></div><div class="resource-detail-actions">'+versionButton+'<button type="button" class="icon-btn resource-detail-close" title="关闭详情"><i data-lucide="x"></i></button></div></div><div class="resource-detail-meta"><span>'+esc(typeLabels[item.resource_type]||item.resource_type)+'</span><span>'+esc(sourceLabel(item.source_kind))+'</span><span>'+esc(item.access_level==='public'?'目录公开，文件鉴权':'访问受限')+'</span></div><h4>版本记录</h4><div class="resource-version-list">'+versionHtml+'</div><h4>可用文件</h4><div class="resource-file-list">'+fileHtml+'</div>';
      if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();
      detail.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(error){detail.innerHTML='<div class="resource-detail-loading">读取失败：'+esc(error.message||'请稍后重试')+'</div>';}
  }
  async function download(fileId){try{var result=await call('download',{resource_file_id:fileId});if(result&&result.file_url)window.open(result.file_url,'_blank','noopener');else throw new Error('RESOURCE_SIGNED_URL_MISSING');}catch(error){setStatus('文件下载失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}}
  async function adminAction(action,itemId){try{await call(action,{resource_item_id:itemId});await load();}catch(error){setStatus('资源状态更新失败：'+(error.message||'请稍后重试'));}}
  async function updateProgress(itemId,action){
    if(isDemo()){state.progress[itemId]=action==='reset'?{progress_percent:0,status:'not_started'}:{progress_percent:100,status:'completed'};render();setStatus('演示进度仅保存在当前页面');return;}
    try{var result=await call('progress_update',{resource_item_id:itemId,status:action==='reset'?'not_started':'completed',progress_percent:action==='reset'?0:100});if(result&&result.progress)state.progress[itemId]=result.progress;render();}catch(error){setStatus('学习进度保存失败：'+(window.jayServiceErrorText?jayServiceErrorText(error):error.message||'请稍后重试'));}
  }
  function bind(){
    document.querySelectorAll('[data-resource-tab]').forEach(function(button){button.addEventListener('click',function(){state.tab=button.dataset.resourceTab||'market';document.querySelectorAll('[data-resource-tab]').forEach(function(item){var active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-selected',String(active));});setText('resource-section-title',tabLabels[state.tab]);if(state.tab==='academy'&&!isDemo())load();else render();});});
    var refresh=$('resource-refresh');if(refresh)refresh.addEventListener('click',load);var submit=$('resource-search-submit');if(submit)submit.addEventListener('click',load);['resource-query','resource-type-filter','resource-year-filter','resource-market-filter','resource-platform-filter'].forEach(function(id){var node=$(id);if(node)node.addEventListener('keydown',function(event){if(event.key==='Enter')load();});});
    var adminOpen=$('resource-admin-open');if(adminOpen)adminOpen.addEventListener('click',function(){openEditor(null);});var adminNew=$('resource-admin-new');if(adminNew)adminNew.addEventListener('click',function(){openEditor(null);});var adminClose=$('resource-admin-close');if(adminClose)adminClose.addEventListener('click',closeEditor);var form=$('resource-admin-form');if(form)form.addEventListener('submit',saveItem);
    var versionClose=$('resource-version-close');if(versionClose)versionClose.addEventListener('click',closeVersionEditor);var versionCancel=$('resource-version-cancel');if(versionCancel)versionCancel.addEventListener('click',closeVersionEditor);var versionForm=$('resource-version-form');if(versionForm)versionForm.addEventListener('submit',saveVersion);
    var list=$('resource-list');if(list)list.addEventListener('click',function(event){var cardEl=event.target.closest('.resource-card');if(!cardEl)return;var id=cardEl.dataset.resourceId,item=state.items.find(function(row){return String(row.id)===String(id);});var progressButton=event.target.closest('.resource-progress-toggle');if(progressButton){updateProgress(id,progressButton.dataset.progress);return;}if(event.target.closest('.resource-route')){var route=event.target.closest('.resource-route').dataset.route;if(route==='academy'){$('#resource-query').value='';state.tab='academy';document.querySelector('[data-resource-tab="academy"]').click();}else if(typeof switchPage==='function')switchPage(route);return;}if(event.target.closest('.resource-edit')){openEditor(item);return;}if(event.target.closest('.resource-publish')){adminAction('publish_item',id);return;}if(event.target.closest('.resource-archive')){adminAction('archive_item',id);return;}openDetail(id);});
    var detail=$('resource-detail');if(detail)detail.addEventListener('click',function(event){if(event.target.closest('.resource-detail-close')){closeAcademyPlayer();detail.hidden=true;return;}if(event.target.closest('.academy-player-close')){closeAcademyPlayer();return;}var versionButton=event.target.closest('.resource-version-new');if(versionButton){openVersionEditor(state.detailItem,state.detailVersions);return;}var progressButton=event.target.closest('.academy-lesson-progress');if(progressButton){academyProgress(progressButton.dataset.lessonId,progressButton.dataset.progressAction);return;}var enrollButton=event.target.closest('.academy-enroll');if(enrollButton&&!enrollButton.disabled){enrollCourse(enrollButton.dataset.courseId);return;}var favoriteButton=event.target.closest('.academy-favorite');if(favoriteButton){toggleFavorite(favoriteButton.dataset.courseId,favoriteButton.dataset.favorite==='true');return;}var playButton=event.target.closest('.academy-lesson-play');if(playButton){playLesson(playButton.dataset.lessonId);return;}var resourceButton=event.target.closest('.academy-resource-download');if(resourceButton){downloadLessonResource(resourceButton.dataset.lessonId,resourceButton.dataset.fileId);return;}var moduleUp=event.target.closest('.academy-module-up');if(moduleUp){reorderAcademy('module',null,Number(moduleUp.dataset.index),-1);return;}var moduleDown=event.target.closest('.academy-module-down');if(moduleDown){reorderAcademy('module',null,Number(moduleDown.dataset.index),1);return;}var lessonUp=event.target.closest('.academy-lesson-up');if(lessonUp){reorderAcademy('lesson',lessonUp.dataset.moduleId,Number(lessonUp.dataset.index),-1);return;}var lessonDown=event.target.closest('.academy-lesson-down');if(lessonDown){reorderAcademy('lesson',lessonDown.dataset.moduleId,Number(lessonDown.dataset.index),1);return;}var button=event.target.closest('.resource-download');if(button)download(button.dataset.fileId);});if(detail)detail.addEventListener('change',function(event){var videoInput=event.target.closest('.academy-video-upload input');if(videoInput&&videoInput.files&&videoInput.files[0]){uploadLessonVideo(videoInput.dataset.lessonVideo,videoInput.dataset.courseId,videoInput.files[0]);return;}var resourceInput=event.target.closest('.academy-material-upload input');if(resourceInput&&resourceInput.files&&resourceInput.files[0])uploadLessonResource(resourceInput.dataset.lessonResource,resourceInput.dataset.courseId,resourceInput.files[0]);});
  }
  window.resourceCenterLoad=load;
  window.resourceCenterOpenEditor=openEditor;
  window.resourceCenterClosePlayer=closeAcademyPlayer;
  bind();resourceMarketOptions();resourcePlatformOptions();
  if(location.hash==='#content'||location.hash==='#tools')setTimeout(load,0);
})();
