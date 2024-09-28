import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
      <div className="text-center">
        <Image src="/images/logo_white.png" alt="Logo" width={300} height={200} className="mx-auto mb-8" />
        <h1 className="text-4xl font-bold text-white mb-4">Bem-vindo ao BookFlows</h1>
        <p className="text-xl text-white mb-8">Sua jornada literária começa aqui</p>
        <div className="space-x-4">
          <Link href="/login" className="bg-white text-purple-600 px-6 py-3 rounded-md font-semibold hover:bg-gray-100 transition duration-300">
            Entrar
          </Link>
          <Link href="/signup" className="bg-purple-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-purple-700 transition duration-300">
            Cadastrar
          </Link>
        </div>
      </div>
    </div>
  )
}