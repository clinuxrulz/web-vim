export const PRELUDE_PLUGINS: Record<string, string> = {
  'line-numbers.tsx': `
export default {
  metadata: {
    name: "line-numbers",
    author: "Web-Vim Team",
    version: "1.0.0",
    description: "Provides line numbers in the gutter"
  },
  setup: (api: any) => {
    api.log("Setting up line-numbers plugin...");
    api.registerGutter({
      name: "line-numbers",
      width: 4,
      priority: 100,
      render: ({ lineIndex, isCursorLine }: any) => {
        const getVal = (val: any) => (typeof val === "function" ? val() : val);
        const num = () => (getVal(lineIndex) + 1).toString().padStart(3, " ");
        return (
          <text 
            content={() => num() + " "} 
            color={() => getVal(isCursorLine) ? "#ffffff" : "#888888"} 
          />
        );
      }
    });
    api.log("Line-numbers gutter registered");
  }
};
`,
  'hello.tsx': `
export default {
  metadata: {
    name: "hello-plugin",
    description: "A simple plugin that greets you and tracks mode changes."
  },
  setup: (api: any) => {
    api.log("Hello from the virtual prelude!");
    
    api.registerCommand("hello", (args: string[]) => {
      api.log("Command :hello executed with args:", args);
      console.log("HELLO FROM PRELUDE PLUGIN!", args);
    });

    api.on("ModeChanged", (data: any) => {
      api.log("Mode changed from " + data.from + " to " + data.to);
    });
  }
};
`
};
