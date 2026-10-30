import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const moduleFile=process.argv[2];
if(process.argv[3]==='--child'){
 const mode=process.argv[4],directory=process.argv[5],tenant=process.argv[6]||'fixture-tenant';
 const {createTextSender}=await import(pathToFileURL(moduleFile));let calls=0;
 const synced=new Set();const originalSync=fs.fsyncSync;fs.fsyncSync=fd=>{synced.add(fs.realpathSync('/proc/self/fd/'+fd));originalSync(fd);};
 const ev=new EventEmitter();const socket={user:{id:'fixture'},ev,ws:ev,sendMessage:async(jid,content,options)=>{calls++;if(mode==='ack')queueMicrotask(()=>ev.emit('messages.update',[{key:{id:options.messageId,remoteJid:jid,fromMe:true},update:{status:2}}]));return {key:{id:options.messageId}};}};
 const send=createTextSender(new Map([['fixture-account',socket]]),new Set(['fixture-account']),15,0,directory);
 const result=await send({accountId:'fixture-account',tenantId:tenant,recipient:'+10000000001',text:'Synthetic test only',confirmed:true});
 if(calls)assert.ok(synced.has(path.dirname(directory)),'Intent directory parent must be durable before transport');
 console.log(JSON.stringify({result,calls}));
}else{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wa-durable-'));
 function invoke(mode,dir,tenant){const p=spawnSync(process.execPath,[fileURLToPath(import.meta.url),moduleFile,'--child',mode,dir,tenant||'fixture-tenant'],{encoding:'utf8',timeout:10000});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);}
 try{
  const uncertain=path.join(root,'uncertain');assert.equal(invoke('unknown',uncertain).result.status,'unknown');
  const retry=invoke('ack',uncertain);assert.equal(retry.result.code,'send_locked','Uncertain send lost quarantine across process restart');assert.equal(retry.calls,0);
  const known=path.join(root,'known');assert.equal(invoke('ack',known).result.status,'accepted');assert.equal(invoke('ack',known).result.status,'accepted');
  const other=invoke('ack',known,'other-tenant');assert.equal(other.result.code,'account_binding');assert.equal(other.calls,0);
  const broken=path.join(root,'not-a-directory');fs.writeFileSync(broken,'fixture');const unavailable=invoke('ack',broken);assert.equal(unavailable.result.status,'failed');assert.equal(unavailable.calls,0);
  assert.equal(fs.readFileSync(path.join(uncertain,'fixture-account.intent'),'utf8').includes('Synthetic test only'),false);
  console.log('PASS: real process restart quarantine, ACK cleanup, durable tenant binding, storage failure, no message content stored');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
