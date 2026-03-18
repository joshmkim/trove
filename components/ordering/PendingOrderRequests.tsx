interface PendingRequest {
  id: string;
  segments: { quantity: string; product: string }[];
  highlighted: boolean;
}

const pendingRequests: PendingRequest[] = [
  {
    id: "1",
    highlighted: true,
    segments: [
      { quantity: "50 lbs", product: "Oranges" },
      { quantity: "35 lbs", product: "Lemons" },
      { quantity: "20 lbs", product: "Avocados" },
    ],
  },
  {
    id: "2",
    highlighted: false,
    segments: [{ quantity: "30 cartons", product: "Eggs" }],
  },
];

function RequestLine({ request }: { request: PendingRequest }) {
  const text = request.segments.map((s, i) => (
    <span key={i}>
      {i > 0 && <span className="text-warm-gray">, </span>}
      <span className="text-warm-gray">{s.quantity} </span>
      <span className="font-semibold text-charcoal">{s.product}</span>
    </span>
  ));

  if (request.highlighted) {
    return (
      <div className="px-3 py-2 border border-charcoal rounded-sm bg-white text-sm inline-flex flex-wrap gap-x-0.5">
        {text}
      </div>
    );
  }

  return (
    <p className="px-1 py-2 text-sm">
      {text}
    </p>
  );
}

export default function PendingOrderRequests() {
  return (
    <section className="px-6 py-5 border-b border-light-gray">
      <h2 className="text-[20px] font-semibold text-charcoal mb-3">
        Pending Order Requests
      </h2>
      <div className="flex flex-col gap-1">
        {pendingRequests.map((req) => (
          <RequestLine key={req.id} request={req} />
        ))}
      </div>
    </section>
  );
}
