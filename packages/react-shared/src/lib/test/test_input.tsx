import { forwardRef, type ComponentPropsWithRef } from 'react';

type ExampleProps = {
  label: string;
  props: ComponentPropsWithRef<'input'>;
};

export const Example = forwardRef<HTMLInputElement, ExampleProps>(function ({ label, ...props }, ref) {
  return (
    <div style={{ border: '1px solid pink' }}>
      <label style={{ color: 'blue' }}>
        {label}
        <input ref={ref} {...props} />
      </label>
    </div>
  );
});

export default Example;
