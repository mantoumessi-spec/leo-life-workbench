import {DatabaseSync, backup} from 'node:sqlite';
import {mkdirSync, readdirSync, readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

export function openLocalDatabase(directory, migrations) {
  mkdirSync(directory,{recursive:true});
  const database=new DatabaseSync(join(directory,'workbench.sqlite'));
  database.exec('PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  database.exec('CREATE TABLE IF NOT EXISTS desktop_migrations (name TEXT PRIMARY KEY)');
  function prepare(sql, parameters=[]) {
    const execute=(raw=false)=>{
      const statement=database.prepare(sql);
      if(raw)statement.setReturnArrays(true);
      return statement.all(...parameters);
    };
    return {
      bind(...args){return prepare(sql,args);},
      async raw(){return execute(true);},
      async all(){return {success:true,results:execute()};},
      async first(){return execute()[0]??null;},
      async run(){const r=database.prepare(sql).run(...parameters);return {success:true,results:[],meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},
      execute,
    };
  }
  return {
    prepare,
    async batch(statements){
      database.exec('BEGIN IMMEDIATE');
      try{const results=statements.map(s=>({success:true,results:s.execute()}));database.exec('COMMIT');return results;}
      catch(error){database.exec('ROLLBACK');throw error;}
    },
    migrate(){
      for(const name of readdirSync(migrations).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
        if(database.prepare('SELECT 1 FROM desktop_migrations WHERE name=?').get(name))continue;
        database.exec('BEGIN IMMEDIATE');
        try{database.exec(readFileSync(join(migrations,name),'utf8'));database.prepare('INSERT INTO desktop_migrations VALUES (?)').run(name);database.exec('COMMIT');}
        catch(error){database.exec('ROLLBACK');throw error;}
      }
    },
    async snapshot(mode="daily"){
      const folder=join(directory,'backups');mkdirSync(folder,{recursive:true});
      const file=join(folder,`workbench-${mode==='daily'?new Date().toISOString().slice(0,10):new Date().toISOString().replaceAll(':','-')+'-'+mode}.sqlite`);
      if(!existsSync(file))await backup(database,file);
      return file;
    },
    close(){database.close();},
  };
}
