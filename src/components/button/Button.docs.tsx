import { Button } from '@/components/ui/button';

export const ButtonDocs = () => {
  return (
    <div className="p-5">
      <h2>Button Component</h2>
      <p>A reusable button component used across the app.</p>

      <h3>Props</h3>
      <ul>
        <li><strong>variant</strong>: {`"default" | "outline" | "ghost" | "secondary" | "destructive" | "link"`}</li>
        <li><strong>size</strong>: {`"default" | "sm" | "lg" | "xs" | "icon"`}</li>
        <li><strong>children</strong>: ReactNode — Button content</li>
        <li><strong>onClick</strong>: {`() => void`} — Click handler</li>
      </ul>

      <h3>Usage</h3>
      <pre>
        {`<Button variant="default" onClick={() => handleClick()}>
  Click Me
</Button>`}
      </pre>

      <h3>Preview</h3>
      <Button variant="default">Click Me</Button>
    </div>
  );
};
