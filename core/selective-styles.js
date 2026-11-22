// Keep an inherited profile truly neutral: emit only declarations that depend
// on controls the user changed, rather than the integration's preset defaults.
function blocks(css, context = [], result = new Map()) {
  let cursor=0;
  while(cursor<css.length) {
    const open=css.indexOf("{",cursor);if(open<0)break;const selector=css.slice(cursor,open).trim();let end=open+1,depth=1,quote=null;
    for(;end<css.length;end++){const c=css[end];if(quote){if(c==="\\")end++;else if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==="{")depth++;else if(c==="}"&&!--depth)break;}
    const body=css.slice(open+1,end);
    if(selector.startsWith("@"))blocks(body,[...context,selector],result);
    else {
      let start=0,parens=0;quote=null;
      for(let i=0;i<=body.length;i++) {const c=body[i];if(quote){if(c==="\\")i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==="(")parens++;if(c===")")parens--;if((c===";"&&parens===0)||i===body.length){const declaration=body.slice(start,i).trim(),colon=declaration.indexOf(":");if(colon>0){const property=declaration.slice(0,colon).trim(),value=declaration.slice(colon+1).trim(),key=JSON.stringify([context,selector,property]);result.set(key,{context,selector,property,value});}start=i+1;}}
    }
    cursor=end+1;
  }
  return result;
}
function alternative(definition,current) {
  if(definition.type==="boolean")return !current;
  if(definition.type==="color")return current==="#010203"?"#a1b2c3":"#010203";
  if(definition.type==="range")return current===definition.min?definition.max:definition.min;
  if(definition.type==="select")return definition.options.find(v=>v!==current);
  if(definition.type==="colorMap")return {};
  return current?"":"test";
}
function selectiveStyles(module, settings, controller, keys) {
  if(!keys.length)return "";
  const actual=blocks(module.styles(settings,controller)),keep=new Set();
  for(const key of keys) {
    const definition=module.settingsSchema[key];if(!definition||key==="customCss"||key==="cardsShape")continue;
    const changed={...settings,[key]:alternative(definition,settings[key])};const shadow=Object.create(controller);
    if(key==="backgroundImage")shadow.resolvedBackgroundImage=changed.backgroundImage;
    const other=blocks(module.styles(changed,shadow));
    for(const [id,entry]of actual)if(!other.has(id)||other.get(id).value!==entry.value)keep.add(id);
    if(key==="columnColors"||key==="automaticColumnColors")for(const [id,entry]of actual)if(entry.selector.includes("data-cs-kanban-column"))keep.add(id);
  }
  // Include custom-property definitions needed by selected declarations.
  let expanded=true;while(expanded){expanded=false;for(const id of [...keep]){const entry=actual.get(id);for(const match of entry.value.matchAll(/var\((--[a-z0-9-]+)/gi))for(const [dependency,item]of actual)if(item.property===match[1]&&!keep.has(dependency)){keep.add(dependency);expanded=true;}}}
  return [...actual].filter(([id])=>keep.has(id)).map(([,e])=>e.context.reduceRight((text,at)=>`${at}{${text}}`,`${e.selector}{${e.property}:${e.value};}`)).join("\n");
}
module.exports={selectiveStyles,blocks};
