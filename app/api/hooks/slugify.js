import slugify from "slugify";



import React from 'react'

const generateSlug = (name) => {
  return slugify(name,
        {
            replacement: '-',
            lower: true,
            strict: true,
            trim: true
        })
}

export default generateSlug