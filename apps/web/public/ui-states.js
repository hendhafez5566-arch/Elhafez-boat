/** Reusable presentation primitives. Never changes business data or permissions. */
export function emptyState(host,title,description=''){
 const section=document.createElement('section');section.className='boat-empty';section.setAttribute('role','status');
 const icon=document.createElement('span');icon.className='boat-empty-symbol';icon.textContent='◇';icon.setAttribute('aria-hidden','true');
 const heading=document.createElement('strong');heading.textContent=title;section.append(icon,heading);
 if(description){const p=document.createElement('p');p.textContent=description;section.append(p)}
 host.append(section);return section;
}
export function filterBar(...controls){
 const bar=document.createElement('div');bar.className='boat-filterbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','أدوات البحث والتصفية');bar.append(...controls);return bar;
}
export function statusChip(message,tone='neutral'){
 const chip=document.createElement('span');chip.className='boat-status boat-status-'+tone;chip.textContent=message;return chip;
}
