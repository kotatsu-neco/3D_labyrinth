(() => {
  'use strict';

  const KEY = 'ash_labyrinth_save_v2';
  const DIRS = ['北','東','南','西'];
  const DELTA = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];

  const DATA = {
    version: 2,
    facilities: ['宿屋','商店','鑑定所'],
    map: {
      floor:'地下1階',
      rows:[
        '#########',
        '#S..D...#',
        '#.#.###.#',
        '#.#...#.#',
        '#.###.#.#',
        '#...#...#',
        '#.#.#.#.#',
        '#...C..R#',
        '#########'
      ],
      start:{x:1,y:1,dir:1},
      chests:{'4,7':{name:'古い木箱',opened:false,normal:['heal_potion'],unidentified:['unknown_ring']}}
    },
    party:[
      {id:'a',name:'アレン',race:'人間',job:'剣士',position:'front',level:1,exp:0,maxHp:31,hp:31,maxMp:0,mp:0,atk:7,def:3,status:'正常'},
      {id:'b',name:'ボルク',race:'鉱人',job:'守人',position:'front',level:1,exp:0,maxHp:36,hp:36,maxMp:0,mp:0,atk:6,def:5,status:'正常'},
      {id:'c',name:'キリ',race:'草原人',job:'盗賊',position:'front',level:1,exp:0,maxHp:26,hp:26,maxMp:0,mp:0,atk:6,def:2,status:'正常'},
      {id:'d',name:'セリア',race:'森人',job:'司祭',position:'back',level:1,exp:0,maxHp:23,hp:23,maxMp:13,mp:13,atk:3,def:2,status:'正常'},
      {id:'e',name:'メル',race:'人間',job:'魔術師',position:'back',level:1,exp:0,maxHp:19,hp:19,maxMp:17,mp:17,atk:2,def:1,status:'正常'},
      {id:'f',name:'トウマ',race:'風族',job:'弓手',position:'back',level:1,exp:0,maxHp:24,hp:24,maxMp:5,mp:5,atk:5,def:2,status:'正常'}
    ],
    enemies:{
      mold:{name:'黒苔の塊',maxHp:10,atk:3,def:1,exp:10,gold:[8,15]},
      worm:{name:'牙虫',maxHp:14,atk:4,def:1,exp:13,gold:[10,18]},
      bone:{name:'骨の番人',maxHp:18,atk:5,def:2,exp:18,gold:[15,25]},
      shade:{name:'燭台の影',maxHp:16,atk:6,def:1,exp:20,gold:[16,28]},
      armor:{name:'錆びた鎧',maxHp:24,atk:7,def:3,exp:28,gold:[24,38]}
    },
    encounters:[['mold'],['worm','mold'],['bone'],['worm','worm'],['shade'],['armor']],
    items:{
      heal_potion:{name:'小治癒薬',type:'通常',value:12,desc:'味方1人のHPを18回復する。',usable:true},
      tonic:{name:'澄んだ薬瓶',type:'通常',value:18,desc:'味方1人のMPを5回復する。',usable:true},
      old_coin:{name:'古銭',type:'通常',value:16,desc:'商店で売れる古い貨幣。'},
      bronze_knife:{name:'青銅の短剣',type:'通常',value:24,desc:'簡素な短剣。売却用。'},
      leather_guard:{name:'革の小盾',type:'通常',value:28,desc:'軽い盾。売却用。'},
      star_dagger:{name:'星読みの短剣',type:'固有',unique:true,value:90,desc:'刃に星図が刻まれた短剣。'},
      glass_ring:{name:'灰玻璃の指輪',type:'固有',unique:true,value:105,desc:'灰色の光を湛えた指輪。'},
      night_charm:{name:'夜鐘の護符',type:'固有',unique:true,value:120,desc:'鳴らない鐘形の護符。'},
      silver_cup:{name:'古王の銀杯',type:'固有',unique:true,value:150,desc:'底に古い王印がある杯。'},
      sealed_mirror:{name:'封蝋の手鏡',type:'固有',unique:true,value:135,desc:'鏡面に封蝋が押された手鏡。'},
      earth_hammer:{name:'土脈の小槌',type:'固有',unique:true,value:160,desc:'重さに反して手に馴染む小槌。'}
    },
    unidentified:{
      unknown_box:{tempName:'未鑑定品「煤けた小箱」',itemId:'old_coin'},
      unknown_ring:{tempName:'未鑑定品「曇った指輪」',itemId:'glass_ring'},
      unknown_blade:{tempName:'未鑑定品「布巻きの刃」',itemId:'star_dagger'},
      unknown_charm:{tempName:'未鑑定品「封じた護符」',itemId:'night_charm'},
      unknown_cup:{tempName:'未鑑定品「黒ずんだ杯」',itemId:'silver_cup'},
      unknown_mirror:{tempName:'未鑑定品「覆われた鏡」',itemId:'sealed_mirror'},
      unknown_hammer:{tempName:'未鑑定品「重い包み」',itemId:'earth_hammer'}
    },
    shop:[
      {itemId:'heal_potion',price:18},
      {itemId:'tonic',price:26},
      {itemId:'bronze_knife',price:42},
      {itemId:'leather_guard',price:48}
    ]
  };

  const BUILD_ID = '20260608-occlusion-v06';
  const app = document.getElementById('app');
  let state = null;
  let saveNotice = '';

  function setViewportHeight(){
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${Math.max(520, Math.floor(h))}px`);
  }
  window.addEventListener('resize', setViewportHeight);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', setViewportHeight);
    window.visualViewport.addEventListener('scroll', setViewportHeight);
  }
  setViewportHeight();

  const clone = value => JSON.parse(JSON.stringify(value));
  const rand = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const esc = value => String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const nextExp = level => 20 + level * level * 16;
  const aliveParty = () => state.party.filter(p => p.hp > 0);
  const frontAlive = () => state.party.filter(p => p.position === 'front' && p.hp > 0);
  const allDead = () => state.party.every(p => p.hp <= 0);

  function addLog(text, cls=''){
    if(!state) return;
    state.log.push({text, cls});
    if(state.log.length > 80) state.log.splice(0, state.log.length - 80);
  }

  function itemName(id){ return DATA.items[id] ? DATA.items[id].name : id; }
  function itemValue(id){ return DATA.items[id] ? DATA.items[id].value : 0; }
  function countInventory(id){ return state.inventory.filter(x => x === id).length; }
  function addItem(id){
    state.inventory.push(id);
    const item = DATA.items[id];
    if(item && item.unique && !state.catalog.includes(id)) state.catalog.push(id);
  }
  function addUnidentified(templateId){
    const t = DATA.unidentified[templateId];
    if(!t) return;
    state.unidentified.push({
      uid:`u${Date.now()}_${Math.random().toString(16).slice(2)}`,
      templateId,
      tempName:t.tempName,
      itemId:t.itemId
    });
  }
  function removeOneInventory(id){
    const idx = state.inventory.indexOf(id);
    if(idx >= 0){
      state.inventory.splice(idx,1);
      return true;
    }
    return false;
  }

  function validateSave(s){
    return !!(
      s &&
      s.version === DATA.version &&
      Array.isArray(s.party) &&
      s.party.length === 6 &&
      Array.isArray(s.inventory) &&
      Array.isArray(s.unidentified) &&
      Array.isArray(s.log) &&
      s.location &&
      typeof s.location.x === 'number' &&
      typeof s.location.y === 'number' &&
      typeof s.location.dir === 'number' &&
      typeof s.gold === 'number'
    );
  }
  function loadSave(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return {ok:false, reason:'保存データなし'};
      const parsed = JSON.parse(raw);
      if(!validateSave(parsed)) return {ok:false, reason:'保存データの構造が不正'};
      return {ok:true, state:parsed};
    }catch(err){
      return {ok:false, reason:'保存データを読めない'};
    }
  }
  function saveGame(){
    if(!state) return;
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }
    catch(err){ saveNotice = `保存に失敗: ${err.message}`; }
  }
  function resetSave(){
    try{ localStorage.removeItem(KEY); }catch(err){}
    state = null;
    saveNotice = '保存データを初期化した。';
    renderTitle();
  }
  function continueGame(){
    const loaded = loadSave();
    if(loaded.ok){
      state = loaded.state;
      addLog('保存データから再開した。');
      saveGame();
      render();
    }else{
      saveNotice = `続きから再開できない: ${loaded.reason}`;
      renderTitle();
    }
  }

  function createNewState(){
    state = {
      version:DATA.version,
      screen:'city',
      gold:120,
      location:{floor:'地下1階', x:DATA.map.start.x, y:DATA.map.start.y, dir:DATA.map.start.dir},
      party:clone(DATA.party),
      inventory:['heal_potion','heal_potion'],
      unidentified:[],
      catalog:[],
      chests:clone(DATA.map.chests),
      battle:null,
      log:[],
      flags:{visitedDoor:false, steps:0}
    };
    addLog('街の広場に集まった。迷宮入口が開いている。');
    saveGame();
    render();
  }

  function cellAt(x,y){
    if(y < 0 || y >= DATA.map.rows.length || x < 0 || x >= DATA.map.rows[0].length) return '#';
    return DATA.map.rows[y][x];
  }
  function isWall(x,y){ return cellAt(x,y) === '#'; }
  function stepPos(x,y,dir,dist){
    const d = DELTA[(dir + 4) % 4];
    return {x:x + d.x*dist, y:y + d.y*dist};
  }
  function sidePos(x,y,dir,side){
    const d = DELTA[(dir + side + 4) % 4];
    return {x:x + d.x, y:y + d.y};
  }
  function canMoveTo(x,y){ return !isWall(x,y); }
  function cellName(ch){
    if(ch === '#') return '壁';
    if(ch === 'D') return '扉';
    if(ch === 'C') return '宝箱';
    if(ch === 'R') return '帰還階段';
    return '通路';
  }
  function dungeonViewSummary(){
    const loc = state.location;
    const f = stepPos(loc.x,loc.y,loc.dir,1);
    const l = sidePos(loc.x,loc.y,loc.dir,-1);
    const r = sidePos(loc.x,loc.y,loc.dir,1);
    return {front:cellName(cellAt(f.x,f.y)), left:cellName(cellAt(l.x,l.y)), right:cellName(cellAt(r.x,r.y))};
  }

  function moveForward(){
    const n = stepPos(state.location.x,state.location.y,state.location.dir,1);
    if(!canMoveTo(n.x,n.y)){
      addLog('正面は壁だ。');
      saveGame();
      render();
      return;
    }
    state.location.x = n.x;
    state.location.y = n.y;
    state.flags.steps++;
    const ch = cellAt(n.x,n.y);
    if(ch === 'D' && !state.flags.visitedDoor){
      state.flags.visitedDoor = true;
      addLog('重い扉を押し開いた。');
    }else if(ch === 'R'){
      addLog('帰還の階段を見つけた。街へ戻れる。');
    }else{
      addLog('一歩進んだ。');
    }
    afterDungeonStep();
  }
  function moveBack(){
    const n = stepPos(state.location.x,state.location.y,state.location.dir,-1);
    if(!canMoveTo(n.x,n.y)){
      addLog('背後は壁だ。');
      saveGame();
      render();
      return;
    }
    state.location.x = n.x;
    state.location.y = n.y;
    state.flags.steps++;
    addLog('後退した。');
    afterDungeonStep();
  }
  function turn(delta){
    state.location.dir = (state.location.dir + delta + 4) % 4;
    addLog(delta > 0 ? '右を向いた。' : '左を向いた。');
    saveGame();
    render();
  }
  function afterDungeonStep(){
    if(Math.random() < 0.2){
      startBattle();
      return;
    }
    saveGame();
    render();
  }
  function inspectCell(){
    const key = `${state.location.x},${state.location.y}`;
    const chest = state.chests[key];
    if(chest && !chest.opened){
      chest.opened = true;
      addLog(`${chest.name}を開けた。`);
      (chest.normal || []).forEach(id => { addItem(id); addLog(`${itemName(id)}を得た。`); });
      (chest.unidentified || []).forEach(id => { addUnidentified(id); addLog(`${DATA.unidentified[id].tempName}を得た。`); });
      saveGame();
      render();
      return;
    }
    if(cellAt(state.location.x,state.location.y) === 'R'){
      goCity('階段を上がり、街へ戻った。');
      return;
    }
    if(Math.random() < 0.55){
      startBattle();
      return;
    }
    addLog('周囲を調べたが、目立つものはない。');
    saveGame();
    render();
  }
  function enterDungeon(){
    state.screen = 'dungeon';
    addLog('地下1階へ入った。');
    saveGame();
    render();
  }
  function goCity(msg='街へ戻った。'){
    state.screen = 'city';
    state.battle = null;
    addLog(msg);
    saveGame();
    render();
  }

  function startBattle(){
    const group = pick(DATA.encounters).map((id,i) => {
      const e = clone(DATA.enemies[id]);
      e.id = `e${i}_${Date.now()}`;
      e.hp = e.maxHp;
      return e;
    });
    state.battle = {turn:1, enemies:group, commands:{}, guards:{}};
    state.screen = 'battle';
    addLog('敵が現れた。');
    addLog(group.map(e => e.name).join('、') + '。');
    saveGame();
    render();
  }
  const enemyAlive = () => state.battle ? state.battle.enemies.filter(e => e.hp > 0) : [];
  const firstEnemy = () => enemyAlive()[0];
  function currentCommandActor(){
    if(!state.battle) return null;
    return state.party.find(p => p.hp > 0 && !state.battle.commands[p.id]);
  }
  function commandName(cmd){
    return {attack:'攻撃', defend:'防御', magic:'魔法', escape:'逃走'}[cmd] || cmd;
  }
  function setBattleCommand(cmd){
    if(!state.battle) return;
    const actor = currentCommandActor();
    if(!actor){
      resolvePartyCommands();
      return;
    }
    state.battle.commands[actor.id] = cmd;
    addLog(`${actor.name}に「${commandName(cmd)}」を指示した。`);
    if(currentCommandActor()){
      saveGame();
      render();
      return;
    }
    resolvePartyCommands();
  }
  function resolvePartyCommands(){
    if(!state.battle) return;
    addLog(`【${state.battle.turn}ターン目】`, 'turn');
    state.battle.guards = {};
    const actors = state.party.filter(p => p.hp > 0);
    for(const p of actors){
      const cmd = state.battle.commands[p.id] || 'defend';
      if(cmd === 'escape'){
        const rate = p.job === '盗賊' ? 0.58 : 0.42;
        addLog(`${p.name}は退路を探した。`);
        if(Math.random() < rate){
          addLog(`${p.name}の判断で、隊は戦場を離脱した。`);
          state.screen = 'dungeon';
          state.battle = null;
          saveGame();
          render();
          return;
        }
        addLog('しかし逃げ道をつかめない。');
        continue;
      }
      if(cmd === 'defend'){
        state.battle.guards[p.id] = true;
        addLog(`${p.name}は身を守った。`);
        continue;
      }
      if(cmd === 'magic'){
        performCharacterMagic(p);
        if(checkVictory()) return;
        continue;
      }
      performCharacterAttack(p);
      if(checkVictory()) return;
    }
    enemyTurn();
  }
  function performCharacterAttack(p){
    const target = firstEnemy();
    if(!target) return;
    let chance = p.position === 'front' ? 0.86 : 0.58;
    if(p.job === '弓手') chance = 0.84;
    if(p.status === '疲労') chance -= 0.08;
    if(Math.random() > chance){
      addLog(`${p.name}の攻撃は外れた。`);
      return;
    }
    let base = p.atk + rand(0,3) - target.def;
    if(p.position === 'back' && p.job !== '弓手') base = Math.floor(base * 0.5);
    const dmg = Math.max(1, base);
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`${p.name}の攻撃。${target.name}に${dmg}ダメージ。`);
    if(target.hp <= 0) addLog(`${target.name}を倒した。`);
  }
  function performCharacterMagic(p){
    if(p.job === '司祭'){
      if(p.mp < 3){
        addLog(`${p.name}は祈りを唱えられない。`);
        return;
      }
      const wounded = state.party.filter(x => x.hp > 0 && x.hp < x.maxHp).sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
      if(wounded){
        p.mp -= 3;
        const heal = 8 + p.level * 4 + rand(0,2);
        wounded.hp = Math.min(wounded.maxHp, wounded.hp + heal);
        addLog(`${p.name}が癒しの祈りを唱えた。${wounded.name}のHPが${heal}回復。`);
        return;
      }
      p.mp -= 3;
      const target = firstEnemy();
      if(target){
        const dmg = 4 + p.level * 2;
        target.hp = Math.max(0, target.hp - dmg);
        addLog(`${p.name}が聖句を唱えた。${target.name}に${dmg}ダメージ。`);
        if(target.hp <= 0) addLog(`${target.name}を倒した。`);
      }
      return;
    }
    if(p.job === '魔術師'){
      if(p.mp < 4){
        addLog(`${p.name}は術を唱えられない。`);
        return;
      }
      p.mp -= 4;
      addLog(`${p.name}が火花の術を放った。`);
      enemyAlive().forEach(e => {
        const dmg = 5 + p.level * 3 + rand(0,3);
        e.hp = Math.max(0, e.hp - dmg);
        addLog(`${e.name}に${dmg}ダメージ。`);
        if(e.hp <= 0) addLog(`${e.name}を倒した。`);
      });
      return;
    }
    if(p.job === '弓手' && p.mp >= 2){
      p.mp -= 2;
      const target = firstEnemy();
      if(target){
        const dmg = Math.max(2, p.atk + 3 + rand(0,3) - target.def);
        target.hp = Math.max(0, target.hp - dmg);
        addLog(`${p.name}が集中射を放った。${target.name}に${dmg}ダメージ。`);
        if(target.hp <= 0) addLog(`${target.name}を倒した。`);
      }
      return;
    }
    addLog(`${p.name}は使える魔法を持たない。`);
  }
  function enemyTurn(){
    enemyAlive().forEach(e => {
      const targets = frontAlive().length ? frontAlive() : aliveParty();
      if(!targets.length) return;
      const target = pick(targets);
      let dmg = Math.max(1, e.atk + rand(0,3) - target.def);
      if(state.battle.guards[target.id]) dmg = Math.max(1, Math.floor(dmg * 0.45));
      target.hp = Math.max(0, target.hp - dmg);
      if(target.hp <= 0){
        target.status = '倒';
        addLog(`${e.name}の攻撃。${target.name}は倒れた。`);
      }else{
        addLog(`${e.name}の攻撃。${target.name}は${dmg}ダメージを受けた。`);
      }
    });
    if(allDead()){
      defeat();
      return;
    }
    state.battle.turn++;
    state.battle.commands = {};
    state.battle.guards = {};
    saveGame();
    render();
  }
  function checkVictory(){
    if(enemyAlive().length > 0) return false;
    victory();
    return true;
  }
  function victory(){
    const enemies = state.battle.enemies;
    addLog('敵を倒した。');
    const exp = enemies.reduce((a,e) => a + e.exp, 0);
    const gold = enemies.reduce((a,e) => a + rand(e.gold[0], e.gold[1]), 0);
    aliveParty().forEach(p => { p.exp += exp; });
    state.gold += gold;
    addLog(`経験値 ${exp} を得た。`);
    addLog(`金 ${gold} を得た。`);
    const normal = pick(['heal_potion','old_coin','bronze_knife','leather_guard']);
    addItem(normal);
    addLog(`${itemName(normal)}を得た。`);
    const unknown = pick(Object.keys(DATA.unidentified));
    addUnidentified(unknown);
    addLog(`${DATA.unidentified[unknown].tempName}を得た。`);
    state.battle = null;
    state.screen = 'dungeon';
    saveGame();
    render();
  }
  function defeat(){
    addLog('全員が倒れた。');
    const lost = Math.floor(state.gold * 0.35);
    state.gold -= lost;
    state.party.forEach(p => {
      p.hp = Math.max(1, Math.floor(p.maxHp * 0.35));
      p.mp = 0;
      p.status = '疲労';
    });
    addLog(`通行人に助けられ、街へ戻された。金 ${lost} を失った。`);
    state.battle = null;
    state.screen = 'city';
    saveGame();
    render();
  }

  function restInnChar(charId){
    const p = state.party.find(x => x.id === charId);
    if(!p) return;
    const cost = 6 + p.level * 3;
    if(state.gold < cost){
      addLog(`${p.name}を泊める金が足りない。必要な金は ${cost}。`);
      saveGame();
      render();
      return;
    }
    state.gold -= cost;
    addLog(`${p.name}を宿に泊めた。宿代 ${cost} を支払った。`);
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    if(p.status === '倒' || p.status === '疲労') p.status = '正常';
    addLog(`${p.name}のHPとMPが回復した。`);
    let levels = 0;
    while(p.exp >= nextExp(p.level) && levels < 3){
      p.level++;
      levels++;
      const hpGain = p.job === '守人' ? rand(6,9) : p.job === '魔術師' ? rand(2,4) : p.job === '司祭' ? rand(3,5) : rand(4,7);
      const mpGain = (p.job === '魔術師' || p.job === '司祭') ? rand(3,5) : (p.job === '弓手' ? rand(0,2) : 0);
      const atkGain = (p.job === '剣士' || p.job === '盗賊' || p.job === '弓手') ? rand(1,2) : rand(0,1);
      const defGain = (p.job === '守人' || p.job === '剣士') ? rand(1,2) : rand(0,1);
      p.maxHp += hpGain;
      p.maxMp += mpGain;
      p.atk += atkGain;
      p.def += defGain;
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      addLog(`${p.name}はLv${p.level}になった。`);
      addLog(`最大HP +${hpGain} / 最大MP +${mpGain} / 攻撃 +${atkGain} / 防御 +${defGain}`);
    }
    if(levels === 0) addLog(`${p.name}はまだレベルアップしない。`);
    saveGame();
    render();
  }
  function buyItem(id){
    const offer = DATA.shop.find(s => s.itemId === id);
    if(!offer) return;
    if(state.gold < offer.price){
      addLog('金が足りない。');
      saveGame();
      render();
      return;
    }
    state.gold -= offer.price;
    addItem(id);
    addLog(`${itemName(id)}を購入した。`);
    saveGame();
    render();
  }
  function sellItem(id){
    if(!removeOneInventory(id)){
      addLog('売る品がない。');
      saveGame();
      render();
      return;
    }
    const price = Math.max(1, Math.floor(itemValue(id) * 0.5));
    state.gold += price;
    addLog(`${itemName(id)}を売った。金 ${price} を得た。`);
    saveGame();
    render();
  }
  function identify(uid){
    const idx = state.unidentified.findIndex(u => u.uid === uid);
    if(idx < 0) return;
    const target = state.unidentified[idx];
    const cost = 18;
    if(state.gold < cost){
      addLog('鑑定料が足りない。');
      saveGame();
      render();
      return;
    }
    state.gold -= cost;
    state.unidentified.splice(idx,1);
    addItem(target.itemId);
    const item = DATA.items[target.itemId];
    addLog(`${target.tempName}を鑑定した。`);
    addLog(`正式名称は「${item.name}」。`);
    if(item.unique) addLog('固有品として記録された。');
    saveGame();
    render();
  }
  function useItem(id){
    if(id === 'heal_potion'){
      const t = state.party.filter(p => p.hp > 0 && p.hp < p.maxHp).sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
      if(!t){
        addLog('今は小治癒薬を使う必要がない。');
        render();
        return;
      }
      removeOneInventory(id);
      t.hp = Math.min(t.maxHp, t.hp + 18);
      addLog(`小治癒薬を使った。${t.name}のHPが回復した。`);
      saveGame();
      render();
      return;
    }
    if(id === 'tonic'){
      const t = state.party.filter(p => p.mp < p.maxMp).sort((a,b) => (a.mp/a.maxMp) - (b.mp/b.maxMp))[0];
      if(!t){
        addLog('今は澄んだ薬瓶を使う必要がない。');
        render();
        return;
      }
      removeOneInventory(id);
      t.mp = Math.min(t.maxMp, t.mp + 5);
      addLog(`澄んだ薬瓶を使った。${t.name}のMPが回復した。`);
      saveGame();
      render();
      return;
    }
    addLog('この品はここでは使えない。');
    render();
  }

  function header(title){
    let meta = '';
    if(state){
      if(state.screen === 'dungeon' || state.screen === 'battle'){
        meta = `${state.location.floor} ${state.location.x},${state.location.y} ${DIRS[state.location.dir]} / 金 ${state.gold}`;
      }else{
        meta = `金 ${state.gold} / ${state.unidentified.length ? `未鑑定 ${state.unidentified.length}` : '未鑑定なし'}`;
      }
    }else{
      const loaded = loadSave();
      meta = loaded.ok ? '保存データあり' : loaded.reason;
    }
    return `<div class="header"><div class="header-title">${esc(title)}</div><div class="header-meta">${esc(meta)}</div></div>`;
  }
  function actions(buttons, cls=''){
    return `<div class="actions ${cls}">${buttons.map(b => `<button class="btn ${b.class || ''}" data-act="${b.act}" ${b.arg ? `data-arg="${esc(b.arg)}"` : ''} ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`).join('')}</div>`;
  }
  function dungeonActions(){
    return `<div class="dungeon-pad">
      <div class="spacer" aria-hidden="true"></div><button class="btn primary forward" data-act="forward">前進</button><div class="spacer" aria-hidden="true"></div>
      <button class="btn left" data-act="turnLeft">左旋回</button><button class="btn inspect" data-act="inspect">調べる</button><button class="btn right" data-act="turnRight">右旋回</button>
      <button class="btn town" data-act="city">街へ戻る</button><button class="btn back" data-act="back">後退</button><button class="btn items" data-act="screen" data-arg="items">アイテム</button>
    </div>`;
  }
  function logHtml(){
    const lines = (state ? state.log : []).slice(-8).map(l => `<div class="logline ${esc(l.cls || '')}">${esc(l.text)}</div>`).join('');
    return `<div class="logbox" id="logbox">${lines || '<div class="logline">記録はまだない。</div>'}</div>`;
  }
  function partySummary(){
    const front = state.party.filter(p => p.position === 'front');
    const back = state.party.filter(p => p.position === 'back');
    const card = p => `<div class="member ${p.hp <= 0 ? 'dead' : ''}"><div class="n">${esc(p.name)} Lv${p.level}</div><div class="sub">${esc(p.job)} / ${esc(p.status)}</div><div class="hp">HP ${p.hp}/${p.maxHp}</div><div class="mp">MP ${p.mp}/${p.maxMp}</div></div>`;
    return `<div class="party-box"><div class="rank-label">前衛</div><div class="party-grid">${front.map(card).join('')}</div><div class="rank-label">後衛</div><div class="party-grid">${back.map(card).join('')}</div></div>`;
  }
  function scrollLog(){
    setTimeout(() => {
      const el = document.getElementById('logbox');
      if(el) el.scrollTop = el.scrollHeight;
    },0);
  }


  function assetBuildValue(){
    return getComputedStyle(document.documentElement).getPropertyValue('--asset-build').replace(/["']/g,'').trim();
  }
  function showAssetError(message){
    if(!app) return;
    app.innerHTML = `<div class="asset-error"><b>起動前検査エラー</b><br>${esc(message)}<br><br>index.html / style.css / app.js の3ファイルを同じフォルダに置き、古いキャッシュを更新してください。</div>`;
  }
  function verifyAssetsLoaded(){
    const cssBuild = assetBuildValue();
    if(cssBuild !== BUILD_ID){
      showAssetError(`CSSが正しく読めていません。期待: ${BUILD_ID} / 実際: ${cssBuild || '未読込'}`);
      return false;
    }
    if(!app || app.dataset.build !== BUILD_ID){
      showAssetError(`index.htmlのビルドIDが一致しません。期待: ${BUILD_ID}`);
      return false;
    }
    return true;
  }

  function renderTitle(){
    state = null;
    const loaded = loadSave();
    app.innerHTML = header('灰の迷宮') +
      `<div class="main"><div class="panel title-panel"><div class="game-title">灰の迷宮</div><div class="note">6人の隊列で地下へ潜り、戦い、持ち帰り、鑑定し、宿で成長する。</div>${saveNotice ? `<div class="note warn">${esc(saveNotice)}</div>` : ''}</div></div>` +
      actions([
        {label:'新規開始',act:'new',class:'primary'},
        {label:'続きから',act:'continue',disabled:!loaded.ok},
        {label:'自己診断',act:'diagnostics'},
        {label:'保存初期化',act:'reset',class:'danger'}
      ]);
  }
  function render(){
    if(!state){ renderTitle(); return; }
    if(state.screen === 'city') return renderCity();
    if(state.screen === 'dungeon') return renderDungeon();
    if(state.screen === 'battle') return renderBattle();
    if(state.screen === 'inn') return renderInn();
    if(state.screen === 'shop') return renderShop();
    if(state.screen === 'identify') return renderIdentify();
    if(state.screen === 'party') return renderParty();
    if(state.screen === 'items') return renderItems();
    if(state.screen === 'diagnostics') return renderDiagnostics();
    if(state.screen === 'reset') return renderReset();
  }
  function renderCity(){
    app.innerHTML = header('街') + `<div class="main"><div class="scroll"><div class="panel"><div class="section-title">街の広場</div><div class="note">迷宮で消耗し、街で整える。鑑定・宿屋・商店を回して次の探索へ向かう。</div></div><div class="menu-grid">
      <button class="btn primary" data-act="enterDungeon">迷宮入口</button><button class="btn" data-act="screen" data-arg="inn">宿屋</button><button class="btn" data-act="screen" data-arg="shop">商店</button><button class="btn" data-act="screen" data-arg="identify">鑑定所</button><button class="btn" data-act="screen" data-arg="party">パーティ確認</button><button class="btn" data-act="screen" data-arg="items">アイテム</button><button class="btn" data-act="screen" data-arg="diagnostics">自己診断</button><button class="btn danger" data-act="screen" data-arg="reset">保存初期化</button>
      </div></div></div>` + logHtml() + actions([{label:'迷宮へ',act:'enterDungeon',class:'primary'},{label:'宿屋',act:'screen',arg:'inn'},{label:'鑑定所',act:'screen',arg:'identify'}]);
    scrollLog();
  }
  function renderDungeon(){
    const v = dungeonViewSummary();
    app.innerHTML = header('地下1階') + `<div class="main"><div class="view-wrap"><canvas id="dungeonCanvas"></canvas><div class="view-caption">${esc(state.location.floor)} / ${esc(DIRS[state.location.dir])} / X${state.location.x} Y${state.location.y}</div><div class="view-status"><span>左: ${esc(v.left)}</span><span>前: ${esc(v.front)}</span><span>右: ${esc(v.right)}</span></div></div>${partySummary()}${logHtml()}</div>${dungeonActions()}`;
    requestAnimationFrame(drawDungeon);
    scrollLog();
  }
  function renderBattle(){
    if(!state.battle){
      state.screen = 'dungeon';
      render();
      return;
    }
    const enemies = state.battle.enemies.map(e => `<div class="enemy-card ${e.hp <= 0 ? 'dead' : ''}"><div class="enemy-sigil"></div><div class="enemy-name">${esc(e.name)}</div><div class="enemy-hp">HP ${e.hp}/${e.maxHp}</div></div>`).join('');
    const actor = currentCommandActor();
    const queued = state.party.filter(p => p.hp > 0 && state.battle.commands[p.id]).map(p => `<span class="cmd-chip">${esc(p.name)}：${esc(commandName(state.battle.commands[p.id]))}</span>`).join('');
    const prompt = actor ? `<div class="battle-prompt"><b>指示対象：</b>${esc(actor.name)} <span>${esc(actor.position === 'front' ? '前衛' : '後衛')} / ${esc(actor.job)}</span></div>` : '<div class="battle-prompt"><b>指示解決中</b></div>';
    app.innerHTML = header('戦闘') + `<div class="main"><div class="enemy-stage"><div class="enemy-row">${enemies}</div></div>${prompt}<div class="cmd-queue">${queued || 'まだ指示はない。'}</div>${partySummary()}${logHtml()}</div>` +
      actions([{label:'攻撃',act:'battleCommand',arg:'attack',class:'primary'},{label:'防御',act:'battleCommand',arg:'defend'},{label:'魔法',act:'battleCommand',arg:'magic'},{label:'逃走',act:'battleCommand',arg:'escape'}],'four');
    scrollLog();
  }
  function renderInn(){
    const rows = state.party.map(p => {
      const cost = 6 + p.level * 3;
      const canLevel = p.exp >= nextExp(p.level);
      const isFull = p.hp >= p.maxHp && p.mp >= p.maxMp && p.status === '正常';
      const label = canLevel ? '泊める/Lv確認' : '泊める';
      const stateText = canLevel ? '<span class="good">宿泊でLv上昇可</span>' : (isFull ? '全快でも宿泊可' : '');
      return `<div class="item-row"><div class="info"><div class="name">${esc(p.name)} Lv${p.level} / ${esc(p.job)} / ${esc(p.status)}</div><div class="desc">HP ${p.hp}/${p.maxHp}　MP ${p.mp}/${p.maxMp}<br>次Lv ${p.exp}/${nextExp(p.level)}　宿代 ${cost} ${stateText}</div></div><button class="btn small-btn primary" data-act="restChar" data-arg="${esc(p.id)}">${label}</button></div>`;
    }).join('');
    app.innerHTML = header('宿屋') + `<div class="main"><div class="scroll"><div class="panel"><div class="section-title">宿屋</div><div class="note">宿泊はキャラクター単位。HP/MPが全快でも泊まれる。経験値が足りていれば、その宿泊でレベルアップする。</div></div><div class="panel"><div class="section-title">誰を泊めるか</div>${rows}</div></div>${logHtml()}</div>` +
      actions([{label:'街へ戻る',act:'city'},{label:'パーティ',act:'screen',arg:'party'}],'two');
    scrollLog();
  }
  function renderShop(){
    const shop = DATA.shop.map(s => `<div class="item-row"><div class="info"><div class="name">${esc(itemName(s.itemId))} / 金 ${s.price}</div><div class="desc">${esc(DATA.items[s.itemId].desc)}</div></div><button class="btn small-btn" data-act="buy" data-arg="${s.itemId}">買う</button></div>`).join('');
    const inv = [...new Set(state.inventory)].map(id => `<div class="item-row"><div class="info"><div class="name">${esc(itemName(id))} × ${countInventory(id)}</div><div class="desc">売値 ${Math.floor(itemValue(id)*0.5)}</div></div><button class="btn small-btn" data-act="sell" data-arg="${id}">売る</button></div>`).join('') || '<div class="note">売れる品はない。</div>';
    app.innerHTML = header('商店') + `<div class="main"><div class="scroll"><div class="panel"><div class="section-title">購入</div>${shop}</div><div class="panel"><div class="section-title">売却</div>${inv}</div></div>${logHtml()}</div>` +
      actions([{label:'街へ戻る',act:'city'},{label:'アイテム',act:'screen',arg:'items'}],'two');
    scrollLog();
  }
  function renderIdentify(){
    const list = state.unidentified.map(u => `<div class="item-row"><div class="info"><div class="name">${esc(u.tempName)}</div><div class="desc">鑑定料 18。正式名称と価値が分かる。</div></div><button class="btn small-btn" data-act="identify" data-arg="${u.uid}">鑑定</button></div>`).join('') || '<div class="note">未鑑定品はない。</div>';
    app.innerHTML = header('鑑定所') + `<div class="main"><div class="scroll"><div class="panel"><div class="section-title">未鑑定品</div>${list}</div><div class="panel"><div class="section-title">固有品記録</div><div class="note">${state.catalog.map(id => `・${itemName(id)}`).join('<br>') || 'まだ記録はない。'}</div></div></div>${logHtml()}</div>` +
      actions([{label:'街へ戻る',act:'city'},{label:'アイテム',act:'screen',arg:'items'}],'two');
    scrollLog();
  }
  function renderParty(){
    const rows = state.party.map(p => `<tr><td>${esc(p.position === 'front' ? '前衛' : '後衛')}</td><td>${esc(p.name)}</td><td>${esc(p.race)}</td><td>${esc(p.job)}</td><td>Lv${p.level}</td><td>${p.exp}/${nextExp(p.level)}</td><td>${p.hp}/${p.maxHp}</td><td>${p.mp}/${p.maxMp}</td><td>${p.atk}</td><td>${p.def}</td><td>${esc(p.status)}</td></tr>`).join('');
    app.innerHTML = header('パーティ確認') + `<div class="main"><div class="scroll"><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>列</th><th>名</th><th>種族</th><th>職業</th><th>Lv</th><th>経験値</th><th>HP</th><th>MP</th><th>攻</th><th>防</th><th>状態</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>${logHtml()}</div>` +
      actions([{label:'街へ戻る',act:'city'},{label:'宿屋',act:'screen',arg:'inn'},{label:'アイテム',act:'screen',arg:'items'}]);
    scrollLog();
  }
  function renderItems(){
    const normal = [...new Set(state.inventory)].map(id => `<div class="item-row"><div class="info"><div class="name">${esc(itemName(id))} × ${countInventory(id)} <span class="note">${esc(DATA.items[id].type)}</span></div><div class="desc">${esc(DATA.items[id].desc)}</div></div>${DATA.items[id].usable ? `<button class="btn small-btn" data-act="useItem" data-arg="${id}">使う</button>` : ''}</div>`).join('') || '<div class="note">所持品はない。</div>';
    const unknown = state.unidentified.map(u => `<div class="item-row"><div class="info"><div class="name">${esc(u.tempName)}</div><div class="desc">鑑定所で正式名称が分かる。</div></div></div>`).join('') || '<div class="note">未鑑定品はない。</div>';
    app.innerHTML = header('アイテム') + `<div class="main"><div class="scroll"><div class="panel"><div class="section-title">所持品</div>${normal}</div><div class="panel"><div class="section-title">未鑑定品</div>${unknown}</div><div class="panel"><div class="section-title">固有品記録</div><div class="note">${state.catalog.map(id => `・${itemName(id)}`).join('<br>') || 'まだ記録はない。'}</div></div></div>${logHtml()}</div>` +
      actions([{label:'街へ戻る',act:'city'},{label:'鑑定所',act:'screen',arg:'identify'},{label:'商店',act:'screen',arg:'shop'}]);
    scrollLog();
  }
  function renderReset(){
    app.innerHTML = header('保存初期化') + `<div class="main"><div class="scroll"><div class="panel"><div class="section-title">保存データ初期化</div><div class="note">LocalStorageの保存データを削除する。次回は新規開始からになる。</div></div></div>${logHtml()}</div>` +
      actions([{label:'初期化する',act:'reset',class:'danger'},{label:'街へ戻る',act:'city'}],'two');
  }
  function runDiagnostics(){
    const cssText = [...document.styleSheets].map(sheet => {
      try{ return [...sheet.cssRules].map(rule => rule.cssText).join('\n'); }
      catch(err){ return ''; }
    }).join('\n');
    return [
      ['パーティ人数', DATA.party.length === 6, '初期パーティが6人'],
      ['前衛後衛', DATA.party.filter(p => p.position === 'front').length === 3 && DATA.party.filter(p => p.position === 'back').length === 3, '前衛3人・後衛3人'],
      ['迷宮データ', DATA.map && DATA.map.floor === '地下1階' && DATA.map.rows.length > 0, '地下1階マップあり'],
      ['敵データ', Object.keys(DATA.enemies).length >= 2, '敵が複数存在'],
      ['アイテムデータ', Object.values(DATA.items).some(i => i.type === '通常') && Object.values(DATA.items).filter(i => i.unique).length >= 5, '通常品と固有品5個以上'],
      ['未鑑定品', Object.keys(DATA.unidentified).length > 0, '未鑑定品テンプレートあり'],
      ['施設', DATA.facilities.includes('宿屋') && DATA.facilities.includes('商店') && DATA.facilities.includes('鑑定所'), '宿屋・商店・鑑定所あり'],
      ['セーブ', typeof saveGame === 'function' && typeof loadSave === 'function' && typeof localStorage !== 'undefined', 'LocalStorage処理あり'],
      ['横スクロール対策', /overflow\s*:\s*hidden/.test(cssText) && /max-width\s*:\s*540px/.test(cssText), 'CSS上の横スクロール抑制あり'],
      ['アセット整合', assetBuildValue() === BUILD_ID && app.dataset.build === BUILD_ID, 'index/style/app のビルドID一致']
    ];
  }
  function renderDiagnostics(){
    const results = runDiagnostics();
    const rows = results.map(r => `<tr><td>${esc(r[0])}</td><td class="${r[1] ? 'diag-pass' : 'diag-fail'}">${r[1] ? 'OK' : 'NG'}</td><td>${esc(r[2])}</td></tr>`).join('');
    const fails = results.filter(r => !r[1]).length;
    app.innerHTML = header('自己診断') + `<div class="main"><div class="scroll"><div class="panel"><div class="section-title">HTML内自己診断</div><div class="note">これは実機確認の代替ではない。構造破綻を検出するための内部診断。</div><div class="table-wrap"><table class="table"><thead><tr><th>項目</th><th>判定</th><th>根拠</th></tr></thead><tbody>${rows}</tbody></table></div><p class="${fails ? 'bad' : 'good'}">${fails ? `NG ${fails}件` : '全項目OK'}</p></div></div>${state ? logHtml() : ''}</div>` +
      actions([{label:state ? '街へ戻る' : 'タイトル',act:state ? 'city' : 'title'}],'one');
    scrollLog();
  }

  function drawDungeon(){
    const c = document.getElementById('dungeonCanvas');
    if(!c || !state) return;
    const box = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.floor(box.width * dpr));
    c.height = Math.max(1, Math.floor(box.height * dpr));
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const w = box.width, h = box.height;
    const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#a79b72';
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ecd676';
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(2,2,w-4,h-4);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12,12,w-24,h-24);

    const frames = [
      {l:26, r:w-26, t:24, b:h-40},
      {l:w*0.18, r:w*0.82, t:h*0.18, b:h*0.80},
      {l:w*0.33, r:w*0.67, t:h*0.34, b:h*0.66},
      {l:w*0.43, r:w*0.57, t:h*0.44, b:h*0.56}
    ];
    const loc = state.location;

    let blocked = false;
    for(let depth=0; depth<3 && !blocked; depth++){
      const curr = stepPos(loc.x,loc.y,loc.dir,depth);
      const next = stepPos(loc.x,loc.y,loc.dir,depth+1);
      const left = sidePos(curr.x,curr.y,loc.dir,-1);
      const right = sidePos(curr.x,curr.y,loc.dir,1);
      const near = frames[depth];
      const far = frames[depth+1];
      const frontCell = cellAt(next.x,next.y);

      drawCorridorSlice(near, far, {
        leftOpen: !isWall(left.x,left.y),
        rightOpen: !isWall(right.x,right.y),
        frontCell
      });

      if(frontCell === '#'){
        drawFrontWall(far, false);
        blocked = true;
      }else if(frontCell === 'D'){
        drawFrontWall(far, true);
        blocked = true;
      }else if(frontCell === 'C'){
        drawChest(far);
      }else if(frontCell === 'R'){
        drawStairs(far);
      }
    }

    drawCompass();

    function drawCorridorSlice(near, far, info){
      // ceiling/floor edges for this visible slice only
      ctx.strokeStyle = 'rgba(167,155,114,.86)';
      ctx.lineWidth = 1.6;
      strokeSeg(near.l,near.t,far.l,far.t);
      strokeSeg(near.r,near.t,far.r,far.t);
      strokeSeg(near.l,near.b,far.l,far.b);
      strokeSeg(near.r,near.b,far.r,far.b);

      // a few floor guides only inside currently visible space
      ctx.strokeStyle = 'rgba(167,155,114,.20)';
      const fy1 = lerp(near.b-8, far.b-2, 0.35);
      const fy2 = lerp(near.b-16, far.b-6, 0.65);
      strokeSeg(near.l+10, fy1, near.r-10, fy1);
      strokeSeg(far.l+6, fy2, far.r-6, fy2);

      // side treatment
      if(info.leftOpen) drawSideOpening(near, far, 'left');
      else drawSideWall(near, far, 'left');
      if(info.rightOpen) drawSideOpening(near, far, 'right');
      else drawSideWall(near, far, 'right');

      // if front remains open, show the next frame boundary only; otherwise front wall will close it
      if(info.frontCell !== '#' && info.frontCell !== 'D'){
        ctx.strokeStyle = 'rgba(167,155,114,.70)';
        strokeSeg(far.l,far.t,far.r,far.t);
        strokeSeg(far.l,far.b,far.r,far.b);
      }
    }

    function drawSideWall(near, far, side){
      const xNear = side==='left' ? near.l : near.r;
      const xFar = side==='left' ? far.l : far.r;
      ctx.strokeStyle = 'rgba(167,155,114,.88)';
      strokeSeg(xNear,near.t,xFar,far.t);
      strokeSeg(xNear,near.b,xFar,far.b);
      strokeSeg(xFar,far.t,xFar,far.b);
    }

    function drawSideOpening(near, far, side){
      const xNear = side==='left' ? near.l : near.r;
      const xFar = side==='left' ? far.l : far.r;
      const yTopNear = near.t + (near.b-near.t)*0.32;
      const yBottomNear = near.b - (near.b-near.t)*0.32;
      const yTopFar = far.t + (far.b-far.t)*0.28;
      const yBottomFar = far.b - (far.b-far.t)*0.28;
      ctx.strokeStyle = 'rgba(167,155,114,.88)';
      // outer edges
      strokeSeg(xNear,near.t,xFar,far.t);
      strokeSeg(xNear,near.b,xFar,far.b);
      // opening jambs; no geometry behind the opening is drawn here
      strokeSeg(xNear,yTopNear,xFar,yTopFar);
      strokeSeg(xNear,yBottomNear,xFar,yBottomFar);
    }

    function drawFrontWall(fr, withDoor){
      ctx.strokeStyle = 'rgba(167,155,114,.92)';
      ctx.lineWidth = 1.7;
      strokeSeg(fr.l,fr.t,fr.r,fr.t);
      strokeSeg(fr.l,fr.b,fr.r,fr.b);
      strokeSeg(fr.l,fr.t,fr.l,fr.b);
      strokeSeg(fr.r,fr.t,fr.r,fr.b);
      if(withDoor){
        const ww = (fr.r-fr.l)*0.40;
        const hh = (fr.b-fr.t)*0.70;
        const x = (fr.l+fr.r)/2 - ww/2;
        const y = fr.b - hh;
        ctx.strokeStyle = accent;
        // door drawn on the wall plane
        strokeSeg(x,y,x+ww,y);
        strokeSeg(x,y,x,y+hh);
        strokeSeg(x+ww,y,x+ww,y+hh);
        strokeSeg(x,y+hh,x+ww,y+hh);
        strokeSeg(x+ww/2,y,x+ww/2,y+hh);
        ctx.fillStyle = 'rgba(236,214,118,.65)';
        ctx.beginPath();
        ctx.arc(x+ww*0.73, y+hh*0.56, 2.7, 0, Math.PI*2);
        ctx.fill();
      } else {
        const cx = (fr.l+fr.r)/2;
        ctx.strokeStyle = 'rgba(167,155,114,.30)';
        strokeSeg(cx,fr.t,cx,fr.b);
      }
      ctx.lineWidth = 1.6;
    }

    function drawChest(fr){
      const cx = (fr.l+fr.r)/2;
      const ww = Math.max(24,(fr.r-fr.l)*0.20);
      const hh = Math.max(14,(fr.b-fr.t)*0.12);
      const x = cx-ww/2, y = fr.b-hh-6;
      ctx.strokeStyle = accent;
      ctx.strokeRect(x,y,ww,hh);
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.quadraticCurveTo(cx,y-hh*0.75,x+ww,y);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(cx-2,y+hh*0.35,4,4);
    }

    function drawStairs(fr){
      const cx = (fr.l+fr.r)/2;
      const baseY = fr.b-8;
      ctx.strokeStyle = 'rgba(174,230,170,.92)';
      for(let i=0;i<4;i++){
        const y = baseY-i*8;
        const ww = 28+i*14;
        strokeSeg(cx-ww/2,y,cx+ww/2,y);
      }
      strokeSeg(cx-34,baseY,cx,fr.t+8);
      strokeSeg(cx+34,baseY,cx,fr.t+8);
    }

    function drawCompass(){
      const cx = w - 34, cy = 34;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx,cy,18,0,Math.PI*2);
      ctx.stroke();
      const ang = (-Math.PI/2) + state.location.dir * Math.PI/2;
      strokeSeg(cx,cy,cx+Math.cos(ang)*12,cy+Math.sin(ang)*12);
      ctx.fillStyle = 'rgba(238,232,208,.88)';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(DIRS[state.location.dir],cx,cy+30);
    }

    function strokeSeg(x1,y1,x2,y2){
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    }

    function lerp(a,b,t){ return a + (b-a)*t; }
  }

  function setScreen(name){
    if(!state && name === 'diagnostics'){
      state = {
        screen:'diagnostics',
        version:DATA.version,
        party:clone(DATA.party),
        inventory:[],
        unidentified:[],
        log:[],
        gold:0,
        location:{floor:'地下1階', x:DATA.map.start.x, y:DATA.map.start.y, dir:DATA.map.start.dir},
        catalog:[],
        chests:clone(DATA.map.chests),
        flags:{}
      };
      renderDiagnostics();
      state = null;
      return;
    }
    if(!state) return;
    state.screen = name;
    saveGame();
    render();
  }
  function handleAction(act,arg){
    if(act === 'new') return createNewState();
    if(act === 'continue') return continueGame();
    if(act === 'title') return renderTitle();
    if(act === 'diagnostics'){
      if(state){ state.screen = 'diagnostics'; render(); }
      else setScreen('diagnostics');
      return;
    }
    if(act === 'reset'){
      if(confirm('保存データを初期化しますか？')) resetSave();
      return;
    }
    if(act === 'screen') return setScreen(arg);
    if(act === 'city') return goCity('街へ戻った。');
    if(!state) return;
    if(act === 'enterDungeon') return enterDungeon();
    if(act === 'forward') return moveForward();
    if(act === 'back') return moveBack();
    if(act === 'turnLeft') return turn(-1);
    if(act === 'turnRight') return turn(1);
    if(act === 'inspect') return inspectCell();
    if(act === 'battleCommand') return setBattleCommand(arg);
    if(act === 'restChar') return restInnChar(arg);
    if(act === 'buy') return buyItem(arg);
    if(act === 'sell') return sellItem(arg);
    if(act === 'identify') return identify(arg);
    if(act === 'useItem') return useItem(arg);
    console.error('Unknown action:', act, arg);
    addLog(`未対応の操作: ${act}`, 'bad');
    render();
  }

  app.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-act]');
    if(!btn || btn.disabled) return;
    handleAction(btn.dataset.act, btn.dataset.arg);
  });

  window.__DRPG_TEST__ = {
    DATA,
    runDiagnostics,
    loadSave,
    validateSave,
    handleAction,
    getState:() => state
  };
  if(verifyAssetsLoaded()) renderTitle();
})();
