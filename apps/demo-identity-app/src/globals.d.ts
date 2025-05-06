declare namespace JSX {
  interface IntrinsicElements {
    "claim-button": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & {
      environment?: "production" | "development" | "staging"
    }
  }
}
