import React from 'react'

export default function TopAppBar(){
  return (
    <header className="md:hidden flex justify-between items-center w-full px-margin-mobile h-16 bg-surface-container-lowest dark:bg-inverse-surface border-b border-on-surface/10 fixed top-0 left-0 z-50">
      <h1 className="font-headline-md text-headline-md font-black tracking-tighter text-primary-container dark:text-primary-container">M9 TCG</h1>
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined text-primary-container dark:text-primary-fixed cursor-pointer active:opacity-80 hover:bg-surface-container-high transition-colors p-sm rounded-none">notifications</span>
        <div className="w-8 h-8 bg-surface-variant rounded overflow-hidden tcg-border ml-sm">
          <img alt="User profile avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCx9gOhuibGw0Dts1hddr34X-akjIhEorA0_DSTRKB_i5PaZitul9og4e2EyU_rVt73ZPaK7hzql71ybeBEP971koJP3Pe209n9gqY3t3VHsdvPrqwXEO1pSuAss8qXF_5gRHYoGuvhuZwYKeh72MkhhEm7pT5xUbCOkfAD5KDGSjrZ3Zff-7PKwAWQujd8V7s5YyY9gpaF0veOi3jtQB9uk4r3cpeeUjDojY26-W-a5iiiEYi4J7I"/>
        </div>
      </div>
    </header>
  )
}
