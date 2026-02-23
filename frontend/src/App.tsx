import { Routes, Route } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import Login from "./pages/Login"
import Map from "./pages/Map"
import Journal from "./pages/Journal"
import Admin from "./pages/Admin"

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/map" element={<Map />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
