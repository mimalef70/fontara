import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  //   const message = await querySomeApi(req.body.id)

  res.send({
    message: `salam ${req.body.id}`
  })
}

export default handler
