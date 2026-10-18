import { Button } from '@/components/ui/button';

export const ButtonDocs = () => {
  return (
    <div className="p-5">
      <h2>Button Component</h2>
      <p>A button component used across the app.</p>

      <h3>Props</h3>
      <ul>
        <li><strong>variant</strong>: {`"default" | "outline" | "ghost" | "secondary" | "destructive" | "link"`}</li>
        <li><strong>size</strong>: {`"default" | "sm" | "lg" | "xs" | "icon"`}</li>
        <li><strong>children</strong>: ReactNode — Button content</li>
        <li><strong>onClick</strong>: {`() => void`} — Click handler</li>
        <li><strong>disabled</strong>: boolean — Disables interaction and applies disabled styling</li>
        <li><strong>loading</strong>: boolean — Renders a loading indicator and blocks interaction</li>
        <li><strong>type</strong>: {`"button" | "submit" | "reset"`} — Native button type</li>
        <li><strong>aria-label</strong>: string — Required when the button has no visible text</li>
      </ul>

      <h3>Usage</h3>
      <pre>
        {`<Button variant="default" onClick={() => handleClick()}>
  Click Me
</Button>`}
      </pre>

      <h3>Preview</h3>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Button variant="default">Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Destructive</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>

      <h3>Destructive control guidance</h3>
      <p>
        Destructive actions must include explicit impact copy and a confirmation boundary before
        execution. The button alone does not confirm destructive actions.
      </p>
      <pre>
        {`<Dialog>
  <DialogContent>
    <DialogTitle>Revoke access?</DialogTitle>
    <DialogDescription>
      This will revoke the address and cannot be undone.
    </DialogDescription>
    <Button variant="destructive">Confirm revocation</Button>
  </DialogContent>
</Dialog>`}
      </pre>

      <h3>Accessibility</h3>
      <ul>
        <li>Keyboard: focusable via Tab and activated with Enter or Space.</li>
        <li>Focus: visible focus ring is preserved in all states.</li>
        <li>Accessible name: provide visible text or <code>aria-label</code>.</li>
        <li>Reduced motion: loading animations respect <code>prefers-reduced-motion</code>.</li>
        <li>Contrast: all variants should meet WCAG 2.1 AA at 200% zoom.</li>
      </ul>
    </div>
  );
};
