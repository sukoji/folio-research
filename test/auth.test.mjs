import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import { Accounts, readResponse } from '../desktop/auth.mjs';
const body=text=>new ReadableStream({start(controller){controller.enqueue(Buffer.from(text));controller.close();}});
test('AI responses require terminal completion and reject failed or interrupted streams',async()=>{
  assert.deepEqual(await readResponse(body('data: {"type":"response.output_text.delta","delta":"Hello"}\n\ndata: {"type":"response.completed"}\n\n')),{answer:'Hello'});
  await assert.rejects(readResponse(body('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')));
  await assert.rejects(readResponse(body('data: {"type":"response.failed"}\n\n')));
});
test('OAuth uses fresh PKCE, stable host identity, validates callback state and exposes no credentials',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'folio-auth-'));let opened;
  const storage={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v),decryptString:v=>v.toString()};
  const a=new Accounts(dir,storage,url=>{opened=new URL(url);});t.after(()=>{a.cancel();rmSync(dir,{recursive:true,force:true});});
  await a.login();assert.equal(opened.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(opened.searchParams.get('code_challenge_method'),'S256');assert.equal(opened.hostname,'auth.openai.com');
  const callback=new URL(opened.searchParams.get('redirect_uri'));callback.searchParams.set('state','wrong');assert.equal((await fetch(callback)).status,400);assert.equal(a.status().pending,true);
  const host=opened.searchParams.get('ext_agent_host_id'),challenge=opened.searchParams.get('code_challenge');a.cancel();await a.login();assert.equal(opened.searchParams.get('ext_agent_host_id'),host);assert.notEqual(opened.searchParams.get('code_challenge'),challenge);
  assert.equal(JSON.stringify(a.status()).includes('access_token'),false);
});

test('a cancelled callback cannot cancel a newer login attempt',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'folio-auth-cancel-'));let opened,rejectToken,started;
  const startedPromise=new Promise(resolve=>{started=resolve;});
  const a=new Accounts(dir,null,url=>{opened=new URL(url);},{sessionOnly:true});
  t.after(()=>{a.cancel();rmSync(dir,{recursive:true,force:true});});
  a.tokenRequest=()=>new Promise((_resolve,reject)=>{rejectToken=reject;started();});
  await a.login();
  const callback=new URL(opened.searchParams.get('redirect_uri'));
  callback.searchParams.set('state',opened.searchParams.get('state'));
  callback.searchParams.set('client_id','test-registration');callback.searchParams.set('code','test-code');
  const response=fetch(callback);await startedPromise;
  a.cancel();await a.login();const newer=a.pending;
  rejectToken(new Error('Expired callback'));
  assert.equal((await response).status,400);assert.equal(a.pending,newer);assert.equal(a.status().error,null);
});
