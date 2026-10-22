import test from 'node:test';
import assert from 'node:assert/strict';
import {exactGroundedAnswer,conservativeSourceMatch} from '../.build/apps/api/src/ai.js';

const sources=[
 {id:'1',question:'عمرة رجب 7 ليالي',answer:'العرض المعتمد الأول'},
 {id:'2',question:'عمرة شعبان 7 ليالي',answer:'العرض المعتمد الثاني'},
 {id:'3',question:'ساعات العمل الرسمية',answer:'من التاسعة حتى الخامسة'}
];
test('Arabic approved-source matching handles nonliteral price questions without inventing data',()=>{
 const match=conservativeSourceMatch(sources,'بكام عمرة رجب 7 ليالي؟');
 assert.equal(match?.id,'1');
 assert.equal(match?.answer,'العرض المعتمد الأول');
 assert.equal(exactGroundedAnswer(sources,'عمرة رجب 7 ليالي')?.id,'1');
});
test('ambiguous or weak matching safely declines rather than guessing an offer',()=>{
 assert.equal(conservativeSourceMatch(sources,'بكام عمرة 7 ليالي'),null);
 assert.equal(conservativeSourceMatch(sources,'حجز طيران جدة بكرة'),null);
 assert.equal(conservativeSourceMatch(sources,'سعر'),null);
 assert.equal(conservativeSourceMatch([], 'عمرة رجب 7 ليالي'),null);
});
