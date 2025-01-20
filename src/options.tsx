import { useState } from "react"

function IndexOptions() {
  const [data, setData] = useState("")

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        backgroundColor: "#f3f4f6"
      }}>
      <p style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>فونت آرا</p>
      <p style={{ fontSize: "1.25rem" }}>ساخته شده با ❤️‍🔥 توسط مصطفی الهیاری</p>
    </div>
  )
}

export default IndexOptions
