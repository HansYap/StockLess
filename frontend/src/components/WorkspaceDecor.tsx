/** Decorative gutters never cover or intercept the content. */
export function WorkspaceDecor() {
 return <div className="ws-decor" aria-hidden="true">{['left','right'].map(side => <div key={side} className={`ws-decor__side ws-decor__side--${side}`}><img src="/homepage/workspace-gutter.svg" alt="" /></div>)}</div>;
}
