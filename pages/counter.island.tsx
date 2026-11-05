import Counter from '../components/Counter' with { island: 'load' }

export default function CounterPage() {
  return (
    <div>
      <h1>Counter page (tsx)</h1>
      <Counter start="10" />
    </div>
  )
}
