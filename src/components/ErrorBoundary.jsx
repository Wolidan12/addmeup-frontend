import {Component,Fragment} from 'react'

// Never render exception messages, API payloads, tokens or stack traces to visitors.
export default class ErrorBoundary extends Component {
 state={failed:false,attempt:0}
 static getDerivedStateFromError(){return {failed:true}}
 render(){
  if(this.state.failed)return <main className="route-state" role="alert" aria-labelledby="recovery-title"><h1 id="recovery-title">Let’s get you back on track</h1><p>This page could not be opened. Your account is not signed out. Saved transactions remain on the server; check their status before trying a payment again.</p><button className="btn" onClick={()=>this.setState(s=>({failed:false,attempt:s.attempt+1}))}>Try opening again</button><a className="btn2" href="/">Return to Danqel</a></main>
  return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
 }
}
