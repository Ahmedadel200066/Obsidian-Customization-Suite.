require('./host-path-stub.cjs');
const test=require('node:test');const assert=require('node:assert/strict');
const {SettingsManager}=require('../core/settings-manager');const {ProfileManager,validateProfile}=require('../core/profile-manager');const {PresentationManager,copy}=require('../core/presentation-manager');const {selectiveStyles}=require('../core/selective-styles');const {shapeSchema,validateShapeOptions}=require('../modules/bases/shape-options');const {CARD_SHAPES,cardShapeStyles}=require('../modules/bases/card-shapes');
async function fixture({data=null,files=new Map(),mode='light',failSave=false}={}){
 let stored=copy(data),host=mode;const calls=[];
 const body={classList:{contains:name=>name===`theme-${host}`}};const doc={body,defaultView:{getComputedStyle:()=>({getPropertyValue:name=>({'--interactive-accent':'rgb(12, 120, 90)','--background-primary':host==='light'?'rgb(250, 250, 250)':'rgb(25, 25, 25)','--text-normal':host==='light'?'rgb(30, 30, 30)':'rgb(230, 230, 230)'}[name]||'')})}};body.ownerDocument=doc;
 const plugin={manifest:{id:'customization-studio'},app:{workspace:{containerEl:{ownerDocument:doc}},vault:{configDir:'.obsidian',adapter:{exists:async p=>files.has(p),read:async p=>files.get(p),write:async(p,v)=>{calls.push('write');files.set(p,v);},copy:async(a,b)=>{calls.push('copy');if(files.has(b))throw Error('Destination file already exists!');files.set(b,files.get(a));},rename:async(a,b)=>{calls.push('rename');if(files.has(b))throw Error('Destination file already exists!');files.set(b,files.get(a));files.delete(a);},process:async(p,fn)=>{calls.push('process');if(!files.has(p))throw Error('Missing file');const value=fn(files.get(p));files.set(p,value);return value;},remove:async p=>{calls.push('remove');files.delete(p);}}}},loadData:async()=>stored,saveData:async value=>{calls.push('data');if(failSave)throw Error('simulated data failure');stored=copy(value);},notifyUser:()=>{}};
 plugin.settingsManager=new SettingsManager(plugin,0);await plugin.settingsManager.load();plugin.profileManager=new ProfileManager(plugin.settingsManager);plugin.profileManager.load();plugin.presentation=new PresentationManager(plugin);await plugin.presentation.load();plugin.profileManager.presentation=plugin.presentation;
 return {plugin,pm:plugin.profileManager,p:plugin.presentation,files,calls,data:()=>stored,host:value=>{host=value;},save:()=>plugin.settingsManager.save()};
}
test('first-run Default is editable, neutral, captured, first, and integrations are off',async()=>{const {pm,p}=await fixture();const active=pm.getActiveProfile();assert.equal(active.name,'Default');assert.equal(pm.getProfiles()[0].id,active.id);assert.equal(active.studio.neutral,true);assert.equal(active.studio.appearance,'auto');assert.equal(active.variables.surfaceColor,'#fafafa');assert.equal(active.variables.accentColor,'#0c785a');assert.ok(Object.values(active.moduleEnabled).every(v=>v===false));assert.throws(()=>pm.deleteCustomProfile(active.id),/cannot be deleted/);assert.equal(p.getShapeOptions().hover,'off');});
test('migration keeps existing custom profiles but chooses neutral Default only once',async()=>{const old=await fixture();const custom=old.pm.createCustomProfile('Existing');const source=copy(old.plugin.settingsManager.settings);source.activeProfileId=custom.id;const next=await fixture({data:source});assert.equal(next.pm.getActiveProfile().name,'Default');assert.ok(next.pm.getProfile(custom.id));next.pm.setActiveProfile(custom.id);await next.save();const restarted=await fixture({data:next.data(),files:next.files});assert.equal(restarted.pm.getActiveProfile().id,custom.id);});
test('new profiles clone Default even when a built-in preset is selected',async()=>{const {pm,p}=await fixture();pm.updateActiveProfile({variables:{accentColor:'#123456'}});const templateId=p.state.defaultProfileId;pm.setActiveProfile('colorful');const created=pm.createFromDefault();assert.equal(created.name,'Default copy');assert.equal(pm.getActiveProfile().variables.accentColor,'#123456');assert.equal(pm.getActiveProfile().studio.neutral,true);assert.notEqual(created.id,templateId);pm.updateActiveProfile({variables:{accentColor:'#abcdef'}});assert.equal(p.resolveProfile(templateId).variables.accentColor,'#123456');assert.equal(pm.createFromDefault().name,'Default copy 2');});
test('Light/Dark edits are isolated, Auto follows host, mode survives restart',async()=>{const f=await fixture();f.p.setMode('light');f.pm.updateActiveProfile({variables:{accentColor:'#123456'}});f.p.setShapeOptions('disc',{protrusion:49,size:135,hover:'wiggle'});f.pm.updateModuleSettings('bases',{cardsShape:'disc'});f.p.setMode('dark');assert.notEqual(f.pm.getActiveProfile().variables.accentColor,'#123456');assert.notEqual(f.pm.getActiveProfile().variables.surfaceColor,'#fafafa');f.pm.updateActiveProfile({variables:{accentColor:'#abcdef'}});f.p.setMode('auto');f.host('light');assert.equal(f.pm.getActiveProfile().variables.accentColor,'#123456');f.host('dark');assert.equal(f.pm.getActiveProfile().variables.accentColor,'#abcdef');f.p.setMode('light');await f.save();const next=await fixture({data:f.data(),files:f.files,mode:'dark'});assert.equal(next.p.meta().mode,'light');assert.equal(next.pm.getActiveProfile().variables.accentColor,'#123456');assert.equal(next.pm.getActiveProfile().modules.bases.cardsShape,'disc');assert.equal(next.p.getShapeOptions().protrusion,49);assert.equal(next.p.getShapeOptions().hover,'wiggle');});
test('profile export/import and duplicate retain variants and shape settings independently',async()=>{const {pm,p}=await fixture();p.setMode('dark');pm.updateActiveProfile({variables:{accentColor:'#334455'}});pm.updateModuleSettings('bases',{cardsShape:'book'});p.setShapeOptions('book',{size:144,pages:11});const json=pm.exportProfile(pm.getActiveProfile().id);const raw=JSON.parse(json);assert.equal(raw.version,2);assert.equal(raw.profile.modules.bases.cardsShape,undefined);const imported=pm.importProfile(json);assert.equal(p.meta(imported.id).mode,'dark');assert.equal(p.getShapeOptions('book').pages,11);const duplicate=pm.duplicateProfile(imported.id);p.setShapeOptions('book',{pages:2});assert.equal(p.meta(imported.id).shapes.options.book.pages,11);assert.equal(p.meta(duplicate.id).shapes.options.book.pages,2);const legacy=JSON.parse(pm.exportProfile(duplicate.id,true));assert.equal(legacy.format,undefined);assert.equal(legacy.modules.bases.cardsShape,undefined);validateProfile(legacy,pm.knownModules);});
test('resets restore captured baseline, do not introduce a preset, and clear shape overrides',async()=>{const {pm,p}=await fixture();pm.updateActiveProfile({variables:{surfaceColor:'#111111'}});p.resetGlobal();assert.deepEqual(pm.getActiveProfile().studio.globalKeys,[]);assert.equal(pm.getActiveProfile().variables.surfaceColor,'#fafafa');pm.updateModuleSettings('bases',{cardsShape:'disc',cardsBorderWidth:4});p.setShapeOptions('disc',{protrusion:55});p.resetShape('disc');assert.equal(p.getShapeOptions('disc').protrusion,34);p.resetModule('bases');assert.equal(pm.getActiveProfile().moduleEnabled.bases,false);assert.equal(pm.getActiveProfile().modules.bases.cardsShape,'standard');assert.deepEqual(pm.getActiveProfile().studio.moduleKeys,{});});
test('all nine shape schemas validate defaults, numeric limits, unknown keys, and hover-off',()=>{for(const shape of Object.keys(CARD_SHAPES)){const schema=shapeSchema(shape),defaults=validateShapeOptions(shape);assert.equal(defaults.size,100);assert.equal(defaults.hover,'off');for(const [key,d]of Object.entries(schema))if(typeof d.default==='number'){assert.equal(validateShapeOptions(shape,{[key]:d.min})[key],d.min);assert.equal(validateShapeOptions(shape,{[key]:d.max})[key],d.max);assert.throws(()=>validateShapeOptions(shape,{[key]:d.max+1}));assert.throws(()=>validateShapeOptions(shape,{[key]:NaN}));}assert.throws(()=>validateShapeOptions(shape,{nope:2}));for(const hover of ['off','glow','lift','flip','wiggle'])for(const size of [50,100,150]){const css=cardShapeStyles(shape,'preview',{hover,size});assert.doesNotMatch(css,/undefined|NaN/);if(hover!=='off')assert.match(css,/pointer:fine/);}}assert.doesNotMatch(cardShapeStyles('standard','preview',{size:150}),/background|border-radius|object-fit/);});
test('selective styles preserve native colors, even when an edited control equals its default',()=>{const module={settingsSchema:{radius:{type:'range',min:0,max:20},background:{type:'color'},glow:{type:'boolean'}},styles:s=>`.root{border-radius:${s.radius}px;background:${s.background};--t:4px;box-shadow:${s.glow?'0 0 var(--t) red':'none'};}`};const settings={radius:8,background:'#101010',glow:false};const css=selectiveStyles(module,settings,{},['radius']);assert.match(css,/border-radius:8px/);assert.doesNotMatch(css,/background|box-shadow/);assert.equal(selectiveStyles(module,settings,{},[]),'');const glow=selectiveStyles(module,{...settings,glow:true},{},['glow']);assert.match(glow,/--t:4px/);assert.doesNotMatch(glow,/background|radius/);});
test('strict file validation checks baselines and option ranges before mutating profiles',async()=>{const {p,pm}=await fixture();const state=p.snapshot();state.profiles[p.state.defaultProfileId].baseline.light.variables.surfaceColor='bad';assert.throws(()=>p.validateState(state));const bad=JSON.parse(pm.exportProfile(pm.getActiveProfile().id));bad.appearance.shapes.options.disc={protrusion:99};const count=pm.customProfiles.length;assert.throws(()=>pm.importProfile(JSON.stringify(bad)));assert.equal(pm.customProfiles.length,count);});
test('sidecar is committed before legacy settings, with backup and no new shape keys in data.json',async()=>{const f=await fixture();f.pm.updateModuleSettings('bases',{cardsShape:'disc'});f.p.setShapeOptions('disc',{protrusion:41});await f.save();assert.deepEqual(f.calls,['write','write','data','remove']);assert.equal(f.data().customProfiles[0].modules.bases.cardsShape,undefined);f.p.setShapeOptions('disc',{protrusion:44});await f.save();assert.deepEqual(f.calls.slice(-5),['write','write','process','data','remove']);assert.ok(f.files.has(f.p.path+'.bak'));assert.equal(JSON.parse(f.files.get(f.p.path)).transaction.after.activeProfileId,f.pm.getActiveProfile().id);});
test('interrupted pair save recovers the latest profile and shape options on next load',async()=>{const f=await fixture({failSave:true});f.pm.createFromDefault();f.pm.updateModuleSettings('bases',{cardsShape:'disc'});f.p.setShapeOptions('disc',{protrusion:53});await assert.rejects(()=>f.save(),/simulated/);const id=f.pm.getActiveProfile().id;assert.equal(f.data(),null);const next=await fixture({data:null,files:f.files});assert.equal(next.pm.getActiveProfile().id,id);assert.equal(next.p.getShapeOptions().protrusion,53);assert.equal(next.data().activeProfileId,id);});
test('failed sidecar write never overwrites the last legacy data',async()=>{const f=await fixture();await f.save();const before=JSON.stringify(f.data());f.plugin.app.vault.adapter.write=async()=>{throw Error('disk full');};f.pm.updateActiveProfile({variables:{accentColor:'#aabbcc'}});await assert.rejects(()=>f.save(),/disk full/);assert.equal(JSON.stringify(f.data()),before);});

test('editing a followed theme color overrides only that color',async()=>{
 const {pm}=await fixture();pm.updateModuleSettings('calendar',{textColor:'#123456'});const active=pm.getActiveProfile(),module=pm.modules.find(m=>m.id==='calendar');
 assert.equal(active.modules.calendar.useThemeColors,false);assert.deepEqual(active.studio.moduleKeys.calendar,['textColor']);
 const css=selectiveStyles(module,active.modules.calendar,{},active.studio.moduleKeys.calendar);assert.match(css,/#123456/);assert.doesNotMatch(css,/color-dot|weekend|font-size|radius/);
});

test('backup overwrites an existing .bak and a failing backup never blocks saves or repeats warnings',async()=>{const f=await fixture();await f.save();f.p.setShapeOptions('disc',{protrusion:41});await f.save();f.p.setShapeOptions('disc',{protrusion:42});await f.save();assert.ok(f.files.has(f.p.path+'.bak'));const a=f.plugin.app.vault.adapter;const realWrite=a.write;a.write=async(p,v)=>{if(p.endsWith('.bak'))throw Error('EEXIST: file already exists');return realWrite(p,v);};const warns=[];const w=console.warn;console.warn=(...x)=>warns.push(x);try{f.p.setShapeOptions('disc',{protrusion:43});await f.save();f.p.setShapeOptions('disc',{protrusion:44});await f.save();}finally{console.warn=w;}assert.equal(warns.length,1);assert.equal(JSON.parse(f.files.get(f.p.path)).transaction.after.activeProfileId,f.pm.getActiveProfile().id);});


test('neutral Kanban card color and opacity retain their variable consumers',async()=>{
 const f=await fixture(),module=f.pm.modules.find(m=>m.id==='kanban');
 const controller={resolvedBackgroundImage:'',columnColorTokens:new Map()};
 assert.equal(selectiveStyles(module,f.pm.getActiveProfile().modules.kanban,controller,[]),'');
 for(const change of [{cardBackground:'#c12345'},{cardOpacity:42}]){
  f.p.resetModule('kanban');f.pm.updateModuleSettings('kanban',change);
  const active=f.pm.getActiveProfile(),css=selectiveStyles(module,active.modules.kanban,controller,active.studio.moduleKeys.kanban);
  assert.match(css,/--cs-kanban-card-background:rgba/);
  assert.match(css,/background-color:var\(--cs-kanban-card-background\)/);
  assert.match(css,/item-content-wrapper/);assert.match(css,/item-title-wrapper/);
  assert.doesNotMatch(css,/border-radius|padding:|box-shadow|gap:/);
  assert.equal(active.moduleEnabled.kanban,true);
 }
});
test('changed variable consumers are transitive without enabling unrelated token consumers',()=>{
 const module={settingsSchema:{color:{type:'color'},glow:{type:'boolean'}},styles:s=>`.root{--color:${s.color};--derived:var(--color);--shared:4px;color:var(--derived);box-shadow:${s.glow?'0 0 var(--shared) red':'none'};padding:var(--shared);}`};
 const css=selectiveStyles(module,{color:'#123456',glow:false},{},['color']);
 assert.match(css,/color:var\(--derived\)/);assert.doesNotMatch(css,/padding|box-shadow|--shared/);
 const glow=selectiveStyles(module,{color:'#123456',glow:true},{},['glow']);
 assert.match(glow,/--shared:4px/);assert.doesNotMatch(glow,/padding|--color|--derived/);
});


test('repeated Kanban saves avoid destination-exists rename/copy and persist after restart',async()=>{
 const f=await fixture();await f.save();
 const a=f.plugin.app.vault.adapter;
 await assert.rejects(()=>a.rename(f.p.path+'.tmp',f.p.path),/Destination file already exists/);
 await assert.rejects(()=>a.copy(f.p.path,f.p.path+'.bak').then(()=>a.copy(f.p.path,f.p.path+'.bak')),/Destination file already exists/);
 f.calls.length=0;
 for(const color of ['#112233','#445566','#abcdef']){f.pm.updateModuleSettings('kanban',{cardBackground:color});await f.save();}
 assert.equal(f.calls.filter(c=>c==='process').length,3);
 assert.equal(f.calls.includes('rename'),false);assert.equal(f.calls.includes('copy'),false);
 assert.equal(f.files.has(f.p.path+'.tmp'),false);
 const restarted=await fixture({data:f.data(),files:f.files});
 assert.equal(restarted.pm.getActiveProfile().modules.kanban.cardBackground,'#abcdef');
 assert.equal(restarted.pm.getActiveProfile().moduleEnabled.kanban,true);
 const module=restarted.pm.modules.find(m=>m.id==='kanban'),profile=restarted.pm.getActiveProfile();
 const css=selectiveStyles(module,profile.modules.kanban,{resolvedBackgroundImage:'',columnColorTokens:new Map()},profile.studio.moduleKeys.kanban);
 assert.match(css,/rgba\(171, 205, 239, 1\)/);assert.match(css,/background-color:var/);
});

test('write-only adapters overwrite existing sidecars without rename and keep backup',async()=>{
 const f=await fixture();delete f.plugin.app.vault.adapter.process;
 for(const spacing of [11,19,27]){f.pm.updateModuleSettings('kanban',{cardSpacing:spacing});await f.save();}
 assert.equal(f.calls.includes('rename'),false);assert.ok(f.files.has(f.p.path+'.bak'));
 const restarted=await fixture({data:f.data(),files:f.files});assert.equal(restarted.pm.getActiveProfile().modules.kanban.cardSpacing,27);
});

test('pending journal from the old rename failure restores the latest Kanban edits',async()=>{
 const f=await fixture();await f.save();const committed=f.data();
 const real=f.p.writeSidecar;f.p.writeSidecar=async()=>{throw Error('Destination file already exists!');};
 f.pm.updateModuleSettings('kanban',{cardBackground:'#987654'});await assert.rejects(()=>f.save(),/Destination file already exists/);
 assert.ok(f.files.has(f.p.path+'.tmp'));f.p.writeSidecar=real;
 const restarted=await fixture({data:committed,files:f.files});
 assert.equal(restarted.pm.getActiveProfile().modules.kanban.cardBackground,'#987654');
 assert.equal(restarted.pm.getActiveProfile().moduleEnabled.kanban,true);
 assert.equal(restarted.files.has(restarted.p.path+'.tmp'),false);
 await restarted.save();
});

test('journal recovers a torn compatibility write without discarding the last backup',async()=>{
 const f=await fixture();delete f.plugin.app.vault.adapter.process;await f.save();
 const a=f.plugin.app.vault.adapter,write=a.write;
 a.write=async(p,v)=>{if(p===f.p.path){f.files.set(p,'{partial');throw Error('interrupted write');}return write(p,v);};
 f.pm.updateModuleSettings('kanban',{cardOpacity:38});await assert.rejects(()=>f.save(),/interrupted write/);
 const backup=f.files.get(f.p.path+'.bak');
 const restarted=await fixture({data:f.data(),files:f.files});
 assert.equal(restarted.pm.getActiveProfile().modules.kanban.cardOpacity,38);
 assert.equal(restarted.files.get(restarted.p.path+'.bak'),backup);
});


test('an unreadable orphan journal is never replaced by a fresh Default profile',async()=>{
 const f=await fixture();await f.save();const files=new Map([[f.p.path+'.tmp','{partial']]);
 const warn=console.warn;console.warn=()=>{};
 try{await assert.rejects(()=>fixture({data:f.data(),files}),/cannot be recovered safely/);}finally{console.warn=warn;}
 assert.equal(files.size,1);assert.equal(files.get(f.p.path+'.tmp'),'{partial');
});

test('failed sidecar commit keeps data.json unchanged and its pending journal available',async()=>{
 const f=await fixture();await f.save();const before=JSON.stringify(f.data());
 f.plugin.app.vault.adapter.process=async()=>{throw Error('disk full');};
 f.pm.updateModuleSettings('kanban',{cardRadius:25});await assert.rejects(()=>f.save(),/disk full/);
 assert.equal(JSON.stringify(f.data()),before);assert.ok(f.files.has(f.p.path+'.tmp'));
 const restarted=await fixture({data:f.data(),files:f.files});assert.equal(restarted.pm.getActiveProfile().modules.kanban.cardRadius,25);
});

test('one-control resets remove only the current-variant override and keep other controls and profiles',async()=>{
 const f=await fixture();f.p.setMode('light');
 f.pm.updateModuleSettings('kanban',{cardBackground:'#123456',cardRadius:23});
 f.pm.updateActiveProfile({variables:{accentColor:'#aabbcc',textColor:'#112244'}});
 const originalId=f.pm.getActiveProfile().id;
 const other=f.pm.createFromDefault();const otherId=other.id;
 f.pm.setActiveProfile(originalId);f.p.setMode('dark');
 f.pm.updateModuleSettings('kanban',{cardBackground:'#765432'});
 f.pm.updateActiveProfile({variables:{accentColor:'#ccbbaa'}});
 f.p.setMode('light');const baseline=f.p.meta().baseline.light;
 f.p.resetControl('kanban','cardBackground');f.p.resetControl('global','accentColor');
 let active=f.pm.getActiveProfile();
 assert.equal(active.modules.kanban.cardBackground,baseline.modules.kanban.cardBackground);
 assert.equal(active.modules.kanban.cardRadius,23);assert.equal(active.moduleEnabled.kanban,true);
 assert.deepEqual(active.studio.moduleKeys.kanban,['cardRadius']);
 assert.equal(active.variables.accentColor,baseline.variables.accentColor);assert.deepEqual(active.studio.globalKeys,['textColor']);
 f.p.setMode('dark');assert.equal(f.pm.getActiveProfile().modules.kanban.cardBackground,'#765432');assert.equal(f.pm.getActiveProfile().variables.accentColor,'#ccbbaa');
 f.pm.setActiveProfile(otherId);assert.equal(f.pm.getActiveProfile().modules.kanban.cardBackground,'#123456');
 f.pm.setActiveProfile(originalId);await f.save();const restarted=await fixture({data:f.data(),files:f.files});
 restarted.p.setMode('light');assert.deepEqual(restarted.pm.getActiveProfile().studio.moduleKeys.kanban,['cardRadius']);
 assert.throws(()=>f.p.resetControl('kanban','unknown'),/Unknown/);assert.throws(()=>f.p.resetControl('global','unknown'),/Unknown/);
 f.pm.setActiveProfile('minimal');assert.throws(()=>f.p.resetControl('kanban','cardRadius'),/Duplicate/);
});

test('resetting the last neutral control returns the integration to no emitted override CSS',async()=>{
 const f=await fixture();f.pm.updateModuleSettings('kanban',{cardBackground:'#123456'});
 f.p.resetControl('kanban','cardBackground');const active=f.pm.getActiveProfile();
 assert.equal(active.studio.moduleKeys.kanban,undefined);
 const module=f.pm.modules.find(m=>m.id==='kanban');
 assert.equal(selectiveStyles(module,active.modules.kanban,{resolvedBackgroundImage:'',columnColorTokens:new Map()},active.studio.moduleKeys.kanban||[]),'');
 await f.save();const restarted=await fixture({data:f.data(),files:f.files});assert.equal(restarted.pm.getActiveProfile().studio.moduleKeys.kanban,undefined);
});
