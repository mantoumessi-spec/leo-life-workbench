import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Leo 个人工作台',description:'把重要的事，向前推进一点。私人项目与每日行动工作台。',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}

import './simple-workspace.css';

import './project-progress.css';
