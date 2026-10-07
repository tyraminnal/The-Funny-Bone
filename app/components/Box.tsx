export default function Box({ title, children, className = '' }: {
    title: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`ms-box ${className}`}>
            <h2 className="ms-box-head">{title}</h2>
            <div className="ms-box-body">{children}</div>
        </section>
    );
}
