import Link from 'next/link';
import { useState } from 'react';

export default function SellerLayout({ children }) {
  const [open, setOpen] = useState({ experience: false, traffic: false, kita: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggle = (key) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 bg-gray-800 text-white min-h-screen p-4 transform transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:block`}
      >
        <h1 className="text-2xl font-bold mb-8">판매자 페이지</h1>
        <nav>
          <ul>
            <li className="mb-4">
              <button
                onClick={() => toggle('experience')}
                className="w-full text-left hover:bg-gray-700 p-2 rounded flex justify-between items-center"
              >
                체험단
                <span>{open.experience ? '-' : '+'}</span>
              </button>
              {open.experience && (
                <ul className="ml-4 mt-2">
                  <li className="mb-2">
                    <Link href="/seller" className="hover:bg-gray-700 p-2 rounded block">
                      예약 시트
                    </Link>
                  </li>
                  <li className="mb-2">
                    <Link href="/dashboard/products" className="hover:bg-gray-700 p-2 rounded block">
                      예약하기
                    </Link>
                  </li>
                  <li className="mb-2">
                    <Link href="/seller/progress" className="hover:bg-gray-700 p-2 rounded block">
                      진행현황
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            <li className="mb-4">
              <button
                onClick={() => toggle('traffic')}
                className="w-full text-left hover:bg-gray-700 p-2 rounded flex justify-between items-center"
              >
                트래픽
                <span>{open.traffic ? '-' : '+'}</span>
              </button>
              {open.traffic && (
                <ul className="ml-4 mt-2">
                  <li className="mb-2">
                    <Link href="/seller/traffic" className="hover:bg-gray-700 p-2 rounded block">
                      트래픽
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            <li className="mb-4">
              <button
                onClick={() => toggle('kita')}
                className="w-full text-left hover:bg-gray-700 p-2 rounded flex justify-between items-center"
              >
                키타
                <span>{open.kita ? '-' : '+'}</span>
              </button>
              {open.kita && (
                <ul className="ml-4 mt-2">
                  <li className="mb-2">
                    <Link href="/seller/keyword" className="hover:bg-gray-700 p-2 rounded block">
                      키워드분석
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
      </aside>
      <div className="flex flex-col flex-1 md:ml-64">
        <button
          className="p-2 m-2 text-gray-700 bg-gray-200 rounded md:hidden w-10"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
        <main className="flex-1 p-8 bg-gray-100">{children}</main>
      </div>
    </div>
  );
}
