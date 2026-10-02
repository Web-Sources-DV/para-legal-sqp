import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../src/components/Header';
import { DatabaseSettings } from '../src/components/DatabaseSettings';
import { DocumentHistory } from '../src/components/DocumentHistory';
import { AppUser, canOpenTab } from '../src/services/accessPolicy';

test('header hides protected tabs and downloads by role, and direct navigation is guarded', () => {
  for (const role of ['user','admin','owner'] as const) {
    const user: AppUser = {id:'fixture',displayName:'PRUEBA',role,active:true};
    const html=renderToStaticMarkup(React.createElement(Header,{user,activeTab:'wizard',setActiveTab:()=>{}}));
    for(const tab of ['history','database','users','analytics']) {
      const expected=role==='owner'||role==='admin'&&['history','database'].includes(tab);
      assert.equal(html.includes('nav-tab-'+tab),expected);
      assert.equal(canOpenTab(user,tab),expected);
    }
    assert.equal(html.includes('Versión HTML anterior'),role!=='user');
    assert.equal(html.includes('BD compartida'),role!=='user');
  }
});

test('administrator database view has no backup restoration, reset or HTML replacement controls', () => {
  const html=renderToStaticMarkup(React.createElement(DatabaseSettings,{canEdit:false,onDatabaseReload:()=>{}}));
  assert.ok(html.includes('Acceso de consulta'));
  for(const label of ['Restaurar respaldo','Vaciar datos','Migrar datos','Reemplazar archivo','Descargar respaldo completo'])assert.equal(html.includes(label),false);
  const owner=renderToStaticMarkup(React.createElement(DatabaseSettings,{canEdit:true,onDatabaseReload:()=>{}}));
  assert.ok(owner.includes('Restaurar respaldo'));
  assert.ok(owner.includes('Reemplazar archivo'));
});

test('history editing and deletion controls exist only for the owner', () => {
  const doc={id:'test',title:'PRUEBA',fileName:'prueba.docx',clientId:'test',clientName:'PRUEBA',templateId:'test',templateName:'PRUEBA',passportNumber:'TEST',generatedAt:'2026-10-02',fileSizeFormatted:'1 KB',dataSnapshot:{}};
  for(const canEdit of [false,true]) {
    const html=renderToStaticMarkup(React.createElement(DocumentHistory,{canEdit,documents:[doc],templates:[],clients:[],onDocumentsChange:()=>{},onSelectClientAndTemplate:()=>{}}));
    assert.equal(html.includes('Eliminar del Registro'),canEdit);
    assert.equal(html.includes('Editar título del registro'),canEdit);
    assert.equal(html.includes('Re-descargar Documento'),true);
  }
});

