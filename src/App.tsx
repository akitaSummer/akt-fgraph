import { useState } from "react";
import logo from "./logo.svg";
import "./App.css";

// 5000nodes 5000edges
import testData from "./smallData.json";
// 10000nodes 10000edges
// import testData from "./data.json";
// 20000nodes 20000edges
// import testData from "./bigData.json";
import Graph from "./components/Graph";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <Graph data={testData} />
      {/* <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Hello Vite + React!</p>
        <p>
          <button type="button" onClick={() => setCount((count) => count + 1)}>
            count is: {count}
          </button>
        </p>
        <p>
          Edit <code>App.tsx</code> and save to test HMR updates.
        </p>
        <p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
          {' | '}
          <a
            className="App-link"
            href="https://vitejs.dev/guide/features.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vite Docs
          </a>
        </p>
      </header> */}
    </div>
  );
}

export default App;
