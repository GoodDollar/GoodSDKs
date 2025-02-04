interface TruncatedAddressProps {
  address: string;
  length?: number;
}

export function TruncatedAddress({ address, length = 4 }: TruncatedAddressProps) {
  if (!address) return null;
  return (
    <span title={address}>
      {address.slice(0, length + 2)}...{address.slice(-length)}
    </span>
  );
}
