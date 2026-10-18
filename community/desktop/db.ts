import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {drizzle} from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import {openLocalDatabase} from './database.mjs';
let database:ReturnType<typeof openLocalDatabase>;
export async function initialize(directory:string,migrations:string){database=openLocalDatabase(directory,migrations);await database.snapshot();const marker=join(directory,'app-version.txt');if(!existsSync(marker)||readFileSync(marker,'utf8')!=='0.3.0')await database.snapshot('before-upgrade');database.migrate();writeFileSync(marker,'0.3.0');}
export function getD1(){if(!database)throw new Error('Local database not initialized');return database;}
export function getDb(){return drizzle(getD1() as unknown as D1Database,{schema});}
export function close(){database?.close();}
