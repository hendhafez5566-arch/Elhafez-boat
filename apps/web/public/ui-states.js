/** Reusable presentation primitives. Never changes business data or permissions. */
export function emptyState(host,title,description=''){
 const section=document.createElement('section');section.className='boat-empty';section.setAttribute('role','status');
 const icon=document.createElement('span');icon.className='boat-empty-symbol';icon.setAttribute('aria-hidden','true');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('width','25');svg.setAttribute('height','25');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');
 const outline=document.createElementNS('http://www.w3.org/2000/svg','path');outline.setAttribute('d','M4 5h16v14H4z M8 10h8 M8 14h5');svg.append(outline);icon.append(svg);
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
