import {drizzle} from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import {openLocalDatabase} from './database.mjs';
let database:ReturnType<typeof openLocalDatabase>;
export async function initialize(directory:string,migrations:string){database=openLocalDatabase(directory,migrations);await database.snapshot();database.migrate();}
export function getD1(){if(!database)throw new Error('Local database not initialized');return database;}
export function getDb(){return drizzle(getD1() as unknown as D1Database,{schema});}
export function close(){database?.close();}
