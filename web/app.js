(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const elements = Object.fromEntries(['merchant-search','area-input','category-select','sort-select','budget-only','category-chips','results-count','results-hint','results-list','more-btn','reset-btn','empty-reset-btn','loading','error','empty','retry-btn','source-badge','merchant-count','category-count','data-date'].map(id => [id, $(id)]));
  const PAGE_SIZE = 36;
  const popular = ['Restaurants & Food','Groceries & Markets','Cafés & Drinks','Bakeries & Desserts','Beauty & Wellness','Healthcare'];
  const state = {items:[],categories:[],visible:[],shown:PAGE_SIZE,query:'',area:'',category:'',sort:'relevance',budget:false,loaded:false};
  let searchTimer;
  const number = new Intl.NumberFormat('en-SG');
  const normalize = (s) => String(s || '').toLocaleLowerCase('en-SG').normalize('NFKC').trim();

  function create(tag, cls, value) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined) el.textContent = value;
    return el;
  }
  function tagText(category) { return category === 'Unclassified' ? 'Unclassified' : category; }

  function createMerchantCard(item) {
    const card = create('article','merchant-card');
    const head = create('div','card-top');
    const category = create('span','category-tag' + (item.category === 'Unclassified' ? ' unclassified' : ''),tagText(item.category));
    head.append(category);
    if (item.budget) head.append(create('span','budget-tag','Budget meal'));
    card.append(head,create('h3','',item.name),create('p','address',item.address || 'Address not provided'));
    if (item.category === 'Unclassified' && item.suggestion) {
      card.append(create('p','suggestion',`Possible category (unverified): ${item.suggestion}`));
    }
    const bottom = create('div','card-bottom');
    bottom.append(create('span','postal',item.postal ? `S${item.postal}` : 'Singapore'));
    const link = create('a','','View on map');
    link.href = item.map && /^https:\/\/www\.onemap\.gov\.sg\//.test(item.map) ? item.map : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address || item.name)}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.append(create('span','', '↗'));
    bottom.append(link); card.append(bottom);
    return card;
  }

  function updateChips() {
    elements['category-chips'].replaceChildren();
    for (const category of popular) {
      const btn = create('button','chip' + (state.category === category ? ' active' : ''),category.replace('Restaurants & ','').replace('Groceries & ','').replace('Bakeries & ','').replace('Beauty & ',''));
      btn.type = 'button'; btn.setAttribute('aria-pressed',String(state.category === category));
      btn.title = category;
      btn.addEventListener('click',() => { state.category = state.category === category ? '' : category; elements['category-select'].value = state.category; applyFilters(); });
      elements['category-chips'].append(btn);
    }
  }

  function hasFilters() {return Boolean(state.query || state.area || state.category || state.budget || state.sort !== 'relevance');}
  function applyFilters() {
    if (!state.loaded) return;
    const tokens = normalize(state.query).split(/\s+/).filter(Boolean);
    const area = normalize(state.area);
    state.visible = state.items.filter(m => {
      if (state.category && m.category !== state.category) return false;
      if (state.budget && !m.budget) return false;
      if (area && !m.areaText.includes(area)) return false;
      if (tokens.length && !tokens.every(t => m.searchText.includes(t))) return false;
      return true;
    });
    if (state.sort === 'name') state.visible.sort((a,b) => a.name.localeCompare(b.name));
    else if (state.sort === 'category') state.visible.sort((a,b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    else if (tokens.length) state.visible.sort((a,b) => relevance(b,tokens) - relevance(a,tokens));
    state.shown = PAGE_SIZE;
    elements['results-count'].textContent = `${number.format(state.visible.length)} ${state.visible.length === 1 ? 'place' : 'places'} found`;
    elements['results-hint'].textContent = hasFilters() ? 'Matching your filters' : 'A little of everything, across Singapore';
    elements['reset-btn'].hidden = !hasFilters();
    elements['empty'].hidden = state.visible.length !== 0;
    updateChips(); render();
  }
  function relevance(item,tokens) {
    const name = normalize(item.name);
    let score = 0;
    for (const token of tokens) {
      if (name.startsWith(token)) score += 8;
      else if (name.includes(token)) score += 5;
      else if (normalize(item.category + ' ' + item.subcategory).includes(token)) score += 2;
      else score += 1;
    }
    return score;
  }
  function render() {
    const nodes = state.visible.slice(0,state.shown).map(createMerchantCard);
    elements['results-list'].replaceChildren(...nodes);
    const remains = state.visible.length - state.shown;
    elements['more-btn'].hidden = remains <= 0;
    if (remains > 0) elements['more-btn'].textContent = `Show more places (${number.format(remains)} left) ↓`;
  }
  function clearFilters() {
    state.query='';state.area='';state.category='';state.budget=false;state.sort='relevance';
    elements['merchant-search'].value='';elements['area-input'].value='';elements['category-select'].value='';elements['budget-only'].checked=false;elements['sort-select'].value='relevance';
    applyFilters();
  }
  function bind() {
    elements['merchant-search'].addEventListener('input',(e)=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=e.target.value;applyFilters()},140)});
    elements['area-input'].addEventListener('input',(e)=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.area=e.target.value;applyFilters()},140)});
    elements['category-select'].addEventListener('change',(e)=>{state.category=e.target.value;applyFilters()});
    elements['sort-select'].addEventListener('change',(e)=>{state.sort=e.target.value;applyFilters()});
    elements['budget-only'].addEventListener('change',(e)=>{state.budget=e.target.checked;applyFilters()});
    elements['reset-btn'].addEventListener('click',clearFilters);
    elements['empty-reset-btn'].addEventListener('click',clearFilters);
    elements['more-btn'].addEventListener('click',()=>{state.shown+=PAGE_SIZE;render()});
    elements['retry-btn'].addEventListener('click',load);
    document.addEventListener('keydown',(e)=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();elements['merchant-search'].focus()}});
  }

  async function load() {
    elements['error'].hidden = true; elements['loading'].hidden = false;
    try {
      const response = await fetch('./merchants.json', {cache:'no-cache'});
      if(!response.ok) throw new Error(`Data returned ${response.status}`);
      const data = await response.json();
      if(!Array.isArray(data.rows) || !Array.isArray(data.categories) || !data.rows.length) throw new Error('Unexpected directory format');
      state.categories = data.categories;
      state.items = data.rows.map(row => {
        const [name,catIndex,subcategory,confidence,address,postal,budget,map,suggestion,strength] = row;
        const category = data.categories[catIndex] || 'Unclassified';
        const item = {name,category,subcategory,confidence,address,postal,budget:Boolean(budget),map,suggestion,strength};
        item.searchText = normalize(`${name} ${category} ${subcategory} ${address} ${postal}`);
        item.areaText = normalize(`${address} ${postal} ${String(postal).slice(0,2)}`);
        return item;
      });
      elements['category-select'].replaceChildren(new Option('All categories',''));
      [...state.categories].sort((a,b)=>a.localeCompare(b)).forEach(category=>elements['category-select'].add(new Option(category,category)));
      elements['merchant-count'].textContent = number.format(state.items.length);
      elements['category-count'].textContent = number.format(state.categories.filter(c=>c!=='Unclassified').length);
      elements['data-date'].textContent = data.updated || 'Snapshot';
      elements['source-badge'].textContent = `Snapshot · ${data.updated || 'Date unknown'}`;
      state.loaded = true; elements['loading'].hidden = true;
      applyFilters();
    } catch (e) {
      console.error('Unable to load merchant data', e);
      elements['loading'].hidden = true; elements['error'].hidden = false;
      elements['source-badge'].textContent = 'Data unavailable';
      elements['results-count'].textContent = 'Directory unavailable';
    }
  }
  bind();load();
})();
