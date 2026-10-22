type Props = { size?: number; className?: string };

export function Logo({ size = 40, className = "" }: Props) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.svg`}
      alt="Vexx Learn"
      width={size}
      height={size}
      className={`logo-mark ${className}`}
      draggable={false}
    />
  );
}
