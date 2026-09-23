(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const d3=window.d3;
  const flags=[['gb-eng','hr','ENG','CRO'],['gb-eng','gb-sct','ENG','SCO'],['cz','gb-eng','CZE','ENG'],['gb-wls','dk','WAL','DEN'],['gb-eng','de','ENG','GER'],['ua','gb-eng','UKR','ENG'],['gb-eng','dk','ENG','DEN'],['it','gb-eng','ITA','ENG']];
  const source=d3&&window.EURO_DAILY&&window.EURO_MATCHES?{
    daily:d3.csvParse(window.EURO_DAILY).map(r=>[r.date,+r.total,+r.without_matches]),
    matches:d3.csvParse(window.EURO_MATCHES).map((r,i)=>({date:r.date,name:r.match,baseline:+r.baseline,dow:+r.weekday_effect,background:+r.baseline+(+r.weekday_effect),match:+r.match_effect,total:+r.total,ratio:+r.ratio,flags:flags[i]}))
  }:null;
  if(!d3||!source){$('#trend-chart').innerHTML='<div class="empty-chart">Charts could not load. Please reconnect and refresh.</div>';return;}
  const colors={with:'var(--match)',without:'var(--base)',baseline:'var(--base)',dow:'var(--weekday)',match:'var(--match)'};
  const format=d3.format(',.2f'),whole=d3.format(',.0f'),percent=d3.format('.2%'),shortDate=d3.utcFormat('%-d %b'),longDate=d3.utcFormat('%-d %B'),dayName=d3.utcFormat('%A');
  const daily=source.daily.map(r=>({date:r[0],x:new Date(r[0]+'T00:00:00Z'),with:r[1],without:r[2]}));
  const matches=source.matches.map((r,i)=>({...r,index:i,x:new Date(r.date+'T00:00:00Z')}));
  const flag=code=>'https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/'+code+'.svg';
  const img=(code,alt)=>'<img src="'+flag(code)+'" alt="'+alt+'" width="21" height="16">';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let state={view:'daily',period:'full',start:0,end:daily.length-1,selected:6,order:'date',theme:'dark',visible:{with:true,without:true}};
  try{const saved=JSON.parse(localStorage.getItem('euro-dashboard-v2'));if(saved){if(['light','dark'].includes(saved.theme))state.theme=saved.theme;if(['daily','cumulative'].includes(saved.view))state.view=saved.view;if(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<8)state.selected=saved.selected;}}
  catch(e){}
  document.documentElement.dataset.theme=state.theme;
  let tourTimer=null,brushMove=false,brush=null,brushGroup=null,timelineX=null,trendX=null,trendSvg=null;
  const ms=(animated=true)=>animated&&!reduced.matches?650:0;
  const trans=(selection,animate=true)=>selection.interrupt().transition().duration(ms(animate)).ease(d3.easeCubicInOut);
  function persist(){try{localStorage.setItem('euro-dashboard-v2',JSON.stringify({theme:state.theme,view:state.view,selected:state.selected}));}catch(e){}}
  function number(el,n,fmt=whole,animate=true){const node=typeof el==='string'?$(el):el;const old=node._value??n;d3.select(node).interrupt('number').transition('number').duration(ms(animate)).ease(d3.easeCubicOut).tween('text',()=>t=>{node._value=old+(n-old)*t;node.textContent=fmt(node._value);});}
  function selected(){return matches[state.selected];}
  function rows(){let a=0,b=0;return daily.slice(state.start,state.end+1).map(d=>({...d,cumWith:(a+=d.with),cumWithout:(b+=d.without)}));}
  function val(d,k){return state.view==='daily'?d[k]:d[k==='with'?'cumWith':'cumWithout'];}
  function svg(id,height){const el=$(id),width=Math.max(230,el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight));const chart=d3.select(el).selectAll('svg').data([0]).join('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('width',width).attr('height',height).attr('role','img');return{chart,width,height};}
  function tooltip(event,html){const el=$('#tooltip');el.innerHTML=html;el.hidden=false;const bounds=el.getBoundingClientRect();const right=event.clientX+18;el.style.left=Math.max(12,Math.min(innerWidth-bounds.width-12,right))+'px';el.style.top=Math.max(12,Math.min(innerHeight-bounds.height-12,event.clientY-bounds.height-16))+'px';}
  function hideTip(){$('#tooltip').hidden=true;d3.selectAll('.hover-guide,.hover-dot').style('visibility','hidden');}
  function tipRow(a,b,divider=false){return '<div class="tip-row'+(divider?' tip-divider':'')+'"><span>'+a+'</span><span>'+b+'</span></div>';}
  function matchTip(m){return '<div class="tip-title">'+m.name+' · '+shortDate(m.x)+'</div>'+tipRow('Baseline',format(m.baseline))+tipRow('Weekday adjustment',d3.format('+,.2f')(m.dow))+tipRow('Match component',format(m.match))+tipRow('Total fitted exposures',format(m.total),true)+tipRow('Match / background',percent(m.ratio))+tipRow('Match share of total',percent(m.match/m.total));}
  function sync(){
    $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
    $$('[data-series]').forEach(b=>b.setAttribute('aria-pressed',String(state.visible[b.dataset.series])));
    $('#period').value=state.period;$('#match-order').value=state.order;
    $('#theme-toggle').setAttribute('aria-label','Switch to '+(state.theme==='dark'?'light':'dark')+' theme');
    $('#window-label').textContent=longDate(daily[state.start].x)+' – '+longDate(daily[state.end].x)+' 2021';
    $$('.metric-period').forEach(el=>el.textContent=shortDate(daily[state.start].x)+' – '+shortDate(daily[state.end].x)+' 2021');
    $('#zoom-label').textContent=(state.end-state.start+1)+' days';
  }
  function updateMetrics(animate){const data=rows(),w=d3.sum(data,d=>d.with),n=d3.sum(data,d=>d.without);number('#total-with',w,whole,animate);number('#total-without',n,whole,animate);number('#total-gap',w-n,whole,animate);number('#reduction',1-n/w,n=>'−'+percent(n),animate);
    for(const k of ['with','without']){const s=d3.select('#spark-'+k).attr('viewBox','0 0 85 30');let sum=0;const points=data.map(d=>(sum+=d[k]));const x=d3.scaleLinear().domain([0,points.length-1]).range([1,84]),y=d3.scaleLinear().domain([0,d3.max(points)]).range([29,1]);s.selectAll('path').data([points]).join('path').attr('fill','none').attr('stroke',colors[k]).attr('stroke-width',1.8).attr('d',d3.line().x((d,i)=>x(i)).y(y));}
  }
  function animatePath(path,points,animate,area=false){const node=path.node(),old=node._points;path.interrupt();if(!old||!animate||reduced.matches){node._points=points;path.attr('d',area?d3.area().x(p=>p.px).y0(p=>p.py0).y1(p=>p.py)(points):d3.line().x(p=>p.px).y(p=>p.py)(points));return;}
    const oldX=d3.scaleLinear().domain(old.map(p=>p.x)).range(old.map(p=>p.px)).clamp(true),oldY=d3.scaleLinear().domain(old.map(p=>p.x)).range(old.map(p=>p.py)).clamp(true),oldY0=area?d3.scaleLinear().domain(old.map(p=>p.x)).range(old.map(p=>p.py0)).clamp(true):null;
    const target=points.map(p=>({...p,ax:oldX(p.x),ay:oldY(p.x),ay0:area?oldY0(p.x):0}));path.transition().duration(ms()).ease(d3.easeCubicInOut).attrTween('d',()=>t=>{node._points=target.map(p=>({x:p.x,px:p.ax+(p.px-p.ax)*t,py:p.ay+(p.py-p.ay)*t,py0:area?p.ay0+(p.py0-p.ay0)*t:0}));return area?d3.area().x(p=>p.px).y0(p=>p.py0).y1(p=>p.py)(node._points):d3.line().x(p=>p.px).y(p=>p.py)(node._points);});
  }
  function drawTrend(animate=true){
    const {chart:s,width:w}=svg('#trend-chart',304);trendSvg=s;
    const data=rows(),l=w<360?42:49,r=w-16,t=21,b=260;
    const x=d3.scaleUtc().domain(d3.extent(data,d=>d.x)).range([l+3,r-3]),y=d3.scaleLinear().domain([0,d3.max(data.flatMap(d=>[val(d,'with'),val(d,'without')]))*1.17]).nice().range([b,t]);trendX=x;
    s.selectAll('title').data([0]).join('title').text('Fitted exposures with matches and separately simulated exposures without matches. Selected match dates are linked to the match explorer.');
    const defs=s.selectAll('defs').data([0]).join('defs');defs.selectAll('clipPath').data([0]).join('clipPath').attr('id','trend-clip').selectAll('rect').data([0]).join('rect').attr('x',l).attr('y',t).attr('width',r-l).attr('height',b-t);
    const gradient=defs.selectAll('linearGradient').data([0]).join('linearGradient').attr('id','gap-fill').attr('x1','0').attr('y1','0').attr('x2','0').attr('y2','1');gradient.selectAll('stop').data([{o:'0%',a:.19},{o:'100%',a:.015}]).join('stop').attr('offset',d=>d.o).attr('stop-color','var(--match)').attr('stop-opacity',d=>d.a);
    const grid=s.selectAll('g.chart-grid').data([0]).join('g').attr('class','chart-grid').attr('transform',`translate(${l},0)`);trans(grid,animate).call(d3.axisLeft(y).ticks(4).tickSize(-(r-l)).tickFormat(''));
    const ya=s.selectAll('g.y-axis').data([0]).join('g').attr('class','axis y-axis').attr('transform',`translate(${l},0)`);trans(ya,animate).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(10).tickFormat(d3.format('~s')));
    const xa=s.selectAll('g.x-axis').data([0]).join('g').attr('class','axis x-axis').attr('transform',`translate(0,${b})`);trans(xa,animate).call(d3.axisBottom(x).ticks(w<440?3:6).tickFormat(shortDate).tickSize(0).tickPadding(13));
    s.selectAll('text.measure-label').data([0]).join('text').attr('class','svg-label measure-label').attr('x',l).attr('y',12).text(state.view==='daily'?'Daily exposures':'Cumulative exposures');
    const layer=s.selectAll('g.lines').data([0]).join('g').attr('class','lines').attr('clip-path','url(#trend-clip)');
    const area=layer.selectAll('path.gap').data([0]).join('path').attr('class','gap').attr('fill','url(#gap-fill)').style('visibility',state.visible.with&&state.visible.without?'visible':'hidden');animatePath(area,data.map(d=>({x:+d.x,px:x(d.x),py:y(val(d,'with')),py0:y(val(d,'without'))})),animate,true);
    for(const k of ['without','with']){const path=layer.selectAll('path.line-'+k).data([0]).join('path').attr('class','line-'+k).attr('fill','none').attr('stroke',colors[k]).attr('stroke-width',k==='with'?2.6:2).attr('stroke-linejoin','round').attr('stroke-linecap','round').attr('stroke-dasharray',k==='without'?'5 5':null).style('visibility',state.visible[k]?'visible':'hidden');animatePath(path,data.map(d=>({x:+d.x,px:x(d.x),py:y(val(d,k))})),animate);}
    const inRange=matches.filter(m=>m.x>=data[0].x&&m.x<=data.at(-1).x);
    const dots=layer.selectAll('circle.event-dot').data(inRange,d=>d.date).join('circle').attr('class','event-dot').attr('fill','var(--match)').attr('stroke','var(--surface)').attr('stroke-width',2).style('visibility',state.visible.with?'visible':'hidden');trans(dots,animate).attr('r',d=>d.index===state.selected?5.5:3.8).attr('cx',d=>x(d.x)).attr('cy',d=>y(val(data.find(q=>q.date===d.date),'with')));
    const m=selected(),showSelected=m.x>=data[0].x&&m.x<=data.at(-1).x;
    const pick=layer.selectAll('line.selected-date-line').data([0]).join('line').attr('class','selected-date-line').attr('stroke','var(--match)').attr('stroke-opacity',.32).attr('stroke-width',1).attr('stroke-dasharray','3 5').attr('y1',t).attr('y2',b).style('visibility',showSelected?'visible':'hidden');trans(pick,animate).attr('x1',x(m.x)).attr('x2',x(m.x));
    const guide=s.selectAll('line.hover-guide').data([0]).join('line').attr('class','hover-guide').attr('stroke','var(--muted)').attr('stroke-width',1).attr('y1',t).attr('y2',b).style('visibility','hidden');
    const hover=s.selectAll('circle.hover-dot').data(['with','without']).join('circle').attr('class','hover-dot').attr('r',4.5).attr('fill',d=>colors[d]).attr('stroke','var(--surface)').attr('stroke-width',2).style('visibility','hidden');
    const overlay=s.selectAll('rect.trend-hit').data([0]).join('rect').attr('class','trend-hit').attr('x',l).attr('y',t).attr('width',r-l).attr('height',b-t).attr('fill','transparent');
    function show(e){const px=d3.pointer(e,s.node())[0],j=d3.bisector(d=>d.x).center(data,x.invert(px)),d=data[j];guide.attr('x1',x(d.x)).attr('x2',x(d.x)).style('visibility','visible');hover.attr('cx',x(d.x)).attr('cy',k=>y(val(d,k))).style('visibility',k=>state.visible[k]?'visible':'hidden');let html='<div class="tip-title">'+longDate(d.x)+' 2021</div>';for(const k of ['with','without'])if(state.visible[k])html+=tipRow(k==='with'?'With matches':'Without matches',format(val(d,k)));if(state.visible.with&&state.visible.without)html+=tipRow('Difference',format(val(d,'with')-val(d,'without')),true);const match=matches.find(m=>m.date===d.date);if(match)html+=tipRow('Match',match.name,true);tooltip(e,html);}
    overlay.on('pointermove',show).on('pointerleave',e=>{if(e.pointerType!=='touch')hideTip();}).on('click',e=>{const px=d3.pointer(e,s.node())[0],date=x.invert(px),closest=d3.least(matches,m=>Math.abs(m.x-date));if(Math.abs(closest.x-date)<2*86400000)selectMatch(closest.index);show(e);});
  }
  function drawTimeline(){const {chart:s,width:w}=svg('#timeline-chart',53),l=w<360?42:49,r=w-16;
    timelineX=d3.scaleUtc().domain(d3.extent(daily,d=>d.x)).range([l,r]);const y=d3.scaleLinear().domain([0,d3.max(daily,d=>d.with)]).range([38,8]);
    s.selectAll('title').data([0]).join('title').text('Drag the timeline selection to change the visible date window.');
    s.selectAll('path.mini-area').data([daily]).join('path').attr('class','mini-area').attr('fill','var(--muted)').attr('fill-opacity',.16).attr('d',d3.area().x(d=>timelineX(d.x)).y0(39).y1(d=>y(d.with)));
    s.selectAll('line.mini-event').data(matches).join('line').attr('class','mini-event').attr('x1',d=>timelineX(d.x)).attr('x2',d=>timelineX(d.x)).attr('y1',40).attr('y2',44).attr('stroke','var(--match)').attr('stroke-width',2);
    brush=d3.brushX().extent([[l,4],[r,43]]).handleSize(6).on('brush end',e=>{
      if(brushMove)return;if(!e.selection){if(e.type==='end')setRange(0,daily.length-1,'full',true);return;}
      let a=d3.bisector(d=>d.x).center(daily,timelineX.invert(e.selection[0])),b=d3.bisector(d=>d.x).center(daily,timelineX.invert(e.selection[1]));if(b-a<2){if(e.type==='end')moveBrush();return;}
      if(a===state.start&&b===state.end)return;stopTour();state.start=a;state.end=b;state.period=a===0&&b===daily.length-1?'full':'custom';sync();updateMetrics(false);drawTrend(false);if(e.type==='end')hideTip();
    });
    brushGroup=s.selectAll('g.brush').data([0]).join('g').attr('class','brush').call(brush);moveBrush();
  }
  function moveBrush(){if(!brush||!brushGroup)return;brushMove=true;brushGroup.call(brush.move,[timelineX(daily[state.start].x),timelineX(daily[state.end].x)]);brushMove=false;}
  function setRange(a,b,period,animate=true){state.start=a;state.end=b;state.period=period;sync();updateMetrics(animate);drawTrend(animate);moveBrush();hideTip();}
  function updateSpotlight(animate=true){const m=selected();$('#match-counter').textContent='Match '+String(m.index+1).padStart(2,'0')+' / 08';$('#selected-flags').innerHTML=img(m.flags[0],m.name.split(' vs ')[0])+'<span>vs</span>'+img(m.flags[1],m.name.split(' vs ')[1]);$('#selected-name').textContent=m.name;$('#selected-date').textContent=longDate(m.x)+' 2021 · '+dayName(m.x);number('#selected-ratio',m.ratio,n=>d3.format('.2f')(n)+'×',animate);number('#selected-share',m.match/m.total,d3.format('.1%'),animate);number('#selected-baseline',m.baseline,format,animate);number('#selected-dow',m.dow,d3.format('+,.2f'),animate);number('#selected-match',m.match,format,animate);number('#selected-total',m.total,format,animate);const length=2*Math.PI*43;trans(d3.select('#share-arc'),animate).attr('stroke-dasharray',(m.match/m.total*length)+' '+length);
    $('#share-arc').parentElement.setAttribute('aria-label','Match component is '+percent(m.match/m.total)+' of fitted daily exposures.');
    $$('.match-chip').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.index===state.selected)));
    $$('.comparison-row').forEach(b=>{b.classList.toggle('selected',+b.dataset.index===state.selected);b.setAttribute('aria-pressed',String(+b.dataset.index===state.selected));});
  }
  function selectMatch(index,animate=true){state.selected=(index+matches.length)%matches.length;hideTip();updateSpotlight(animate);drawTrend(animate);drawScatter(animate);persist();$('#status').textContent=selected().name+', '+percent(selected().ratio)+' match-to-background ratio.';}
  function comparisonData(){return [...matches].sort(state.order==='ratio'?(a,b)=>b.ratio-a.ratio:state.order==='match'?(a,b)=>b.match-a.match:(a,b)=>a.index-b.index);}
  function drawComparison(animate=true){const container=d3.select('#comparison-body');const old=new Map([...container.node().children].map(n=>[n.dataset.index,n.getBoundingClientRect().top]));
    const groups=container.selectAll('button.comparison-row').data(comparisonData(),d=>d.index).join(enter=>{const b=enter.append('button').attr('class','comparison-row');b.append('span').attr('class','row-identity');b.append('svg').attr('class','component-mini').attr('aria-hidden','true');b.append('span').attr('class','row-ratio');return b;}).attr('data-index',d=>d.index).attr('aria-label',d=>d.name+', '+shortDate(d.x)+', match-to-background '+percent(d.ratio)).on('click',(e,d)=>selectMatch(d.index)).on('pointermove',(e,d)=>tooltip(e,matchTip(d))).on('pointerleave',hideTip).on('focus',(e,d)=>{if(e.currentTarget.matches(':focus-visible')){const b=e.currentTarget.getBoundingClientRect();tooltip({clientX:b.right,clientY:b.top+30},matchTip(d));}}).on('blur',hideTip).order();
    groups.select('.row-identity').html(d=>'<span class="mini-flags">'+img(d.flags[0],d.flags[2])+img(d.flags[1],d.flags[3])+'</span><span><span class="row-name">'+d.flags[2]+'–'+d.flags[3]+'</span><span class="row-date" style="display:block">'+shortDate(d.x)+'</span></span>');
    groups.select('.row-ratio').html(d=>d3.format('.1%')(d.ratio)+'<span><i style="width:'+(d.ratio/d3.max(matches,m=>m.ratio)*100)+'%"></i></span>');
    const min=d3.min(matches,d=>Math.min(0,d.dow)),max=d3.max(matches,d=>d.baseline+Math.max(0,d.dow)+d.match);
    groups.each(function(d){const s=d3.select(this).select('svg'),w=s.node().getBoundingClientRect().width,x=d3.scaleLinear().domain([min*1.15,max*1.025]).range([0,w]);s.attr('viewBox',`0 0 ${w} 27`);s.selectAll('line.zero').data([0]).join('line').attr('class','zero').attr('x1',x(0)).attr('x2',x(0)).attr('y1',0).attr('y2',27).attr('stroke','var(--muted)').attr('stroke-opacity',.38);const parts=[{key:'baseline',a:0,b:d.baseline},{key:'dow',a:d.dow<0?d.dow:d.baseline,b:d.dow<0?0:d.baseline+d.dow},{key:'match',a:d.baseline+Math.max(0,d.dow),b:d.baseline+Math.max(0,d.dow)+d.match}];const bars=s.selectAll('rect').data(parts,p=>p.key).join('rect').attr('y',5).attr('height',17).attr('fill',p=>colors[p.key]);trans(bars,animate).attr('x',p=>x(p.a)).attr('width',p=>Math.max(0,x(p.b)-x(p.a)));if(animate&&!reduced.matches&&old.has(String(d.index))){const dy=old.get(String(d.index))-this.getBoundingClientRect().top;if(dy)this.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:600,easing:'cubic-bezier(.2,.8,.2,1)'});}});
    updateSpotlight(false);
  }
  function drawScatter(animate=true){const {chart:s,width:w}=svg('#scatter-chart',367),l=54,r=w-24,t=35,b=309;
    const x=d3.scaleLinear().domain([0,d3.max(matches,d=>d.background)*1.18]).nice().range([l,r]),y=d3.scaleLinear().domain([0,d3.max(matches,d=>d.match)*1.17]).nice().range([b,t]);
    s.selectAll('title').data([0]).join('title').text('Each point is one match. The horizontal axis is fitted baseline times day-of-week exposures. The vertical axis is fitted match-component exposures. The dashed equality line has match exposures equal to baseline times day-of-week exposures, so their ratio is one. Each point’s vertical value divided by its horizontal value is the match-to-background ratio.');
    const grid=s.selectAll('g.chart-grid').data([0]).join('g').attr('class','chart-grid').attr('transform',`translate(${l},0)`);grid.call(d3.axisLeft(y).ticks(4).tickSize(-(r-l)).tickFormat(''));
    s.selectAll('g.x-axis').data([0]).join('g').attr('class','axis x-axis').attr('transform',`translate(0,${b})`).call(d3.axisBottom(x).ticks(w<390?3:4).tickFormat(d3.format('~s')).tickSize(0).tickPadding(10));
    s.selectAll('g.y-axis').data([0]).join('g').attr('class','axis y-axis').attr('transform',`translate(${l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')).tickSize(0).tickPadding(10));
    const equal=Math.min(x.domain()[1],y.domain()[1]);s.selectAll('line.equality').data([0]).join('line').attr('class','equality').attr('x1',x(0)).attr('x2',x(equal)).attr('y1',y(0)).attr('y2',y(equal)).attr('stroke','var(--muted)').attr('stroke-opacity',.65).attr('stroke-width',1).attr('stroke-dasharray','4 5');
    s.selectAll('text.y-title').data([0]).join('text').attr('class','svg-label y-title').attr('x',l).attr('y',17).text('Match exposures');s.selectAll('text.x-title').data([0]).join('text').attr('class','svg-label x-title').attr('text-anchor','middle').attr('x',(l+r)/2).attr('y',354).text('Baseline × DOW exposures');
    const guides=s.selectAll('path.selected-cross').data([selected()]).join('path').attr('class','selected-cross').attr('fill','none').attr('stroke','var(--match)').attr('stroke-opacity',.25).attr('stroke-width',1);trans(guides,animate).attr('d',d=>`M${l},${y(d.match)}H${x(d.background)}V${b}`);
    const groups=s.selectAll('g.scatter-point').data(matches,d=>d.index).join('g').attr('class','scatter-point').attr('data-index',d=>d.index).style('cursor','pointer');trans(groups,animate).attr('transform',d=>`translate(${x(d.background)},${y(d.match)})`);
    groups.selectAll('circle.halo').data(d=>[d]).join('circle').attr('class','halo').attr('fill','var(--match)').attr('fill-opacity',d=>d.index===state.selected ? .15 : 0).attr('r',d=>d.index===state.selected?18:9);
    const circles=groups.selectAll('circle.point').data(d=>[d]).join('circle').attr('class','point').attr('stroke','var(--surface)').attr('stroke-width',2).attr('fill',d=>d.index===state.selected?'var(--match)':'var(--weekday)');trans(circles,animate).attr('r',d=>d.index===state.selected?7:5.5);
    groups.selectAll('text.point-label').data(d=>[d]).join('text').attr('class','svg-value point-label').attr('x',d=>[0,1,7].includes(d.index)?-11:10).attr('y',d=>d.index===2?17:d.index===0?-11:d.index===1?-10:-8).attr('text-anchor',d=>[0,1,7].includes(d.index)?'end':'start').style('font-size','12px').style('opacity',d=>d.index===state.selected||w>430?1:.7).text(d=>d.flags[2]+'–'+d.flags[3]);
    groups.selectAll('circle.point-hit').data(d=>[d]).join('circle').attr('class','point-hit').attr('r',17).attr('fill','transparent').on('pointermove',(e,d)=>tooltip(e,matchTip(d))).on('pointerleave',hideTip).on('click',(e,d)=>{selectMatch(d.index);tooltip(e,matchTip(d));});
  }
  function buildRibbon(){$('#match-ribbon').innerHTML=matches.map(m=>'<button class="match-chip" data-index="'+m.index+'" aria-pressed="false" aria-label="'+m.name+', '+shortDate(m.x)+'"><span class="flag-pair">'+img(m.flags[0],m.flags[2])+img(m.flags[1],m.flags[3])+'</span><span class="short">'+m.flags[2]+'–'+m.flags[3]+'</span><span class="date">'+shortDate(m.x)+'</span></button>').join('');$$('.match-chip').forEach(b=>b.addEventListener('click',()=>{stopTour();selectMatch(+b.dataset.index);}));}
  function stopTour(){if(tourTimer){clearInterval(tourTimer);tourTimer=null;}$('#play-tour span').textContent='Match tour';$('#play-tour').setAttribute('aria-pressed','false');}
  function playTour(){if(tourTimer){stopTour();return;}setRange(0,daily.findIndex(d=>d.date==='2021-07-30'),'euro',true);selectMatch(0);$('#play-tour span').textContent='Pause tour';$('#play-tour').setAttribute('aria-pressed','true');let index=0;tourTimer=setInterval(()=>{index++;if(index>=matches.length){stopTour();return;}selectMatch(index);},2100);}
  function exportData(){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([window.EURO_MATCHES+'\n'],{type:'text/csv;charset=utf-8;'}));a.href=url;a.download='match_exposures.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('#data-table').innerHTML=matches.map(m=>'<tr><td>'+shortDate(m.x)+'</td><td>'+m.name+'</td><td>'+format(m.baseline)+'</td><td>'+d3.format('+,.2f')(m.dow)+'</td><td>'+format(m.match)+'</td><td>'+format(m.total)+'</td><td>'+percent(m.ratio)+'</td></tr>').join('');
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;sync();drawTrend(true);persist();}));
  $$('[data-series]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.series;if(state.visible[k]&&!state.visible[k==='with'?'without':'with'])return;state.visible[k]=!state.visible[k];sync();hideTip();drawTrend(true);}));
  $('#period').addEventListener('change',e=>{stopTour();const p=e.target.value;if(p==='custom')return;const a=p==='matches'?daily.findIndex(d=>d.date==='2021-06-13'):0,b=p==='full'?daily.length-1:daily.findIndex(d=>d.date===(p==='euro'?'2021-07-30':'2021-07-11'));setRange(a,b,p);});
  $('#match-order').addEventListener('change',e=>{state.order=e.target.value;drawComparison(true);});
  $('#previous-match').addEventListener('click',()=>{stopTour();selectMatch(state.selected-1);});$('#next-match').addEventListener('click',()=>{stopTour();selectMatch(state.selected+1);});
  $('#focus-match').addEventListener('click',()=>{stopTour();const i=daily.findIndex(d=>d.date===selected().date);setRange(Math.max(0,i-5),Math.min(daily.length-1,i+7),'custom');});
  $('#play-tour').addEventListener('click',playTour);
  $('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;sync();persist();});
  $('#export-data').addEventListener('click',exportData);
  $('#open-table').addEventListener('click',()=>$('#data-dialog').showModal());$('#close-table').addEventListener('click',()=>$('#data-dialog').close());
  $('#data-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideTip();stopTour();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTour();});
  function render(animate=false){sync();updateMetrics(animate);drawTrend(animate);drawTimeline();drawComparison(animate);drawScatter(animate);updateSpotlight(animate);}
  buildRibbon();render(false);
  let width=0,resizeTimer;new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(Math.abs(next-width)<1)return;width=next;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>render(false),80);}).observe($('.shell'));
})();
