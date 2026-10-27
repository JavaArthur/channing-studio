import {readFileSync} from 'node:fs'
import {DatabaseSync} from 'node:sqlite'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {LocalD1} from '../../../helpers/local-d1'
const mocks=vi.hoisted(()=>({getRouteEnvWithDb:vi.fn()}))
vi.mock('@/lib/server/route-helpers',()=>({getRouteEnvWithDb:mocks.getRouteEnvWithDb,ensureAuthenticatedRequest:async()=>null,jsonError:(error:string,status=500)=>Response.json({error},{status}),jsonOk:(value:unknown,status=200)=>Response.json(value,{status}),parseJsonBody:async(req:Request)=>req.json()}))
import {POST} from '@/app/api/admin/prompts/route'
import {PATCH} from '@/app/api/admin/prompts/[id]/route'
let sqlite:DatabaseSync
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('db/schema.sql','utf8'));mocks.getRouteEnvWithDb.mockResolvedValue({ok:true,env:{},db:new LocalD1(sqlite)})})
afterEach(()=>sqlite.close())
it('legacy prompt routes preserve exact whitespace but reject a blank-only edit',async()=>{
 const body='  instruction\n\nsecond  line\n'
 const request=(method:string,payload:unknown)=>new Request('http://localhost/api/admin/prompts',{method,headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
 expect((await POST(request('POST',{title:'Prompt',prompt:body}))).status).toBe(200)
 const row=sqlite.prepare('SELECT id,prompt FROM prompts').get()!
 expect(row.prompt).toBe(body)
 const params={params:Promise.resolve({id:String(row.id)})}
 expect((await PATCH(request('PATCH',{prompt:'  updated  \n'}),params)).status).toBe(200)
 expect(sqlite.prepare('SELECT prompt FROM prompts').get()!.prompt).toBe('  updated  \n')
 expect((await PATCH(request('PATCH',{prompt:'  \n'}),params)).status).toBe(400)
 expect(sqlite.prepare('SELECT prompt FROM prompts').get()!.prompt).toBe('  updated  \n')
})
