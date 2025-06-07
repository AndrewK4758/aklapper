import type { SVGProps } from 'react';

interface MenuIconProps extends SVGProps<SVGSVGElement> {
  isOpen: boolean;
  props?: SVGSVGElement;
}

export default function MenuIcon({ isOpen, ...props }: MenuIconProps) {
  return (
    <svg
      {...props}
      version='1.1'
      viewBox='0 0 512 512'
      height='512'
      width='512'
      xmlns-xlink='http://www.w3.org/1999/xlink'
      xmlns='http://www.w3.org/2000/svg'
      xmlns-svg='http://www.w3.org/2000/svg'
    >
      <defs id='defs2'>
        <linearGradient id='linearGradient5051'>
          <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='0.14285472' id='stop5047' />
          <stop style={{ stopColor: '#ff3d00', stopOpacity: 1 }} offset='1' id='stop5049' />
        </linearGradient>
        <linearGradient id='linearGradient5029'>
          <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='0.54587156' id='stop5023' />
          <stop style={{ stopColor: '#ff3d00', stopOpacity: 1 }} offset='1' id='stop5027' />
        </linearGradient>
        <linearGradient id='linearGradient5021'>
          <stop style={{ stopColor: '#ff3d00', stopOpacity: 1 }} offset='0' id='stop5015' />
          <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='0.42393526' id='stop5017' />
        </linearGradient>

        <linearGradient
          xlinkHref='#linearGradient3904'
          id='linearGradient4037'
          x1='-72.710701'
          y1='-4.9980154e-05'
          x2='72.710701'
          y2='-4.9980154e-05'
          gradientUnits='userSpaceOnUse'
        />
        <linearGradient
          xlinkHref='#linearGradient5021'
          id='linearGradient4869'
          gradientUnits='userSpaceOnUse'
          x1='-72.710701'
          y1='-4.9980154e-05'
          x2='72.710701'
          y2='-4.9980154e-05'
          gradientTransform='translate(-4.668283,6.9455869)'
        />
        <linearGradient
          xlinkHref='#linearGradient5029'
          id='linearGradient4871'
          gradientUnits='userSpaceOnUse'
          x1='-72.710701'
          y1='-4.9980154e-05'
          x2='72.710701'
          y2='-4.9980154e-05'
          gradientTransform='translate(4.6694945,6.9455869)'
        />
        <linearGradient
          xlinkHref='#linearGradient5051'
          id='linearGradient5053'
          x1='1.3341413'
          y1='-7.9459286'
          x2='1.3341413'
          y2='-77.989532'
          gradientUnits='userSpaceOnUse'
        />
      </defs>
      <g id='layer1'>
        <g transform='matrix(2.9981832,0,0,2.9981832,256,243.82335)' id='g3397'>
          <path
            style={{
              display: 'inline',
              fill: 'url(#linearGradient4871)',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 4,
              strokeLinejoin: 'round',
              strokeOpacity: 1,
            }}
            d='M 75.380195,-36.355713 4.6694945,-1.0003431 V 85.602187 l 70.7107005,-35.3553 z'
            id='path3391'
          />
          <path
            style={{
              display: 'inline',
              fill: 'url(#linearGradient5053)',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 4,
              strokeLinejoin: 'round',
              strokeOpacity: 1,
            }}
            d='M 70.7107,-43.3013 0,-78.6566 -70.7107,-43.3013 0,-7.94593 Z'
            id='path3393'
          />

          {isOpen && (
            <path
              style={{
                display: '',
                fill: '#333333',
                fillOpacity: 1,
                stroke: '#000000',
                strokeWidth: 0,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }}
              d='m 69.708881,-24.622696 -4.91538,18.344443 4.91538,-4.91538 -4.445039,16.5891162 5.776999,-3.3353532 -6.33499,10.972525 6.670706,3.851336 h -8.338383 l 8.338383,8.338383 -5.883943,10.191288 4.216267,-4.216267 -1.576598,5.883944 3.244274,1.873084 -2.179223,8.132975 -1.15613,2.002473 -1.667676,-0.962833 -5.631067,5.631067 -2.888499,-5.00303 -1.787413,6.670706 -6.223852,-1.667676 1.521741,2.635732 -2.367297,2.367297 -5.971086,-1.599949 -1.322411,4.935303 -5.777001,-3.335354 -1.78741,6.670707 -4.454591,-2.571861 -8.338383,8.338383 -3.335353,-0.893705 -3.926511,6.800919 H 9.6725232 L 14.675553,72.102547 9.6725232,73.443106 13.007876,70.107752 9.6725232,68.182086 14.675553,65.293584 12.829709,62.096488 H 9.6725232 l 1.3405588,-5.00303 1.994794,1.994795 V 57.093458 L 8.0048466,54.204959 16.34323,49.39079 9.6725232,47.603381 13.45473,45.419722 8.0048466,43.959431 13.901581,33.745985 9.6725232,36.187634 11.667318,28.742956 9.6725232,29.277459 14.675553,26.38896 8.0048466,24.601548 9.1294243,20.404573 14.675553,23.606632 12.826843,20.404573 8.0048466,17.620593 11.3402,15.694924 9.2451477,12.06619 7.9045892,7.0631598 10.793092,8.7308364 9.0056827,2.06013 12.341036,5.3954832 v -6.6707064 l 9.005223,2.4129413 -2.355946,-4.0806179 4.023623,1.0781262 3.335353,1.92566621 2.145423,-8.00682221 2.888499,-1.6676766 0.446854,1.6676766 6.223852,-1.6676766 2.888503,-5.0030298 5.418988,3.128655 v -4.796332 l 5.00303,2.8885 -1.667676,-6.223853 h 5.003029 l -0.893704,3.335353 2.888499,-1.667676 1.340559,-5.00303 3.335353,0.893705 2.441648,-4.229058 5.777002,-3.335353 -2.888502,5.003029 z'
              id='menu-icon-hole'
              inkscape-label='Hole'
            />
          )}

          <path
            style={{
              display: 'inline',
              fill: 'url(#linearGradient4869)',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 4,
              strokeLinejoin: 'round',
              strokeOpacity: 1,
            }}
            d='m -4.668283,-1.0003431 -70.7107,-35.3553699 v 86.6026 l 70.7107,35.3553 z'
            id='path3395'
          />
        </g>
      </g>
    </svg>

    // <svg
    //   {...props}
    //   version='1.1'
    //   viewBox='0 0 512 512'
    //   height='512'
    //   width='512'
    //   xmlns-xlink='http://www.w3.org/1999/xlink'
    //   xmlns='http://www.w3.org/2000/svg'
    //   xmlns-svg='http://www.w3.org/2000/svg'
    // >
    //   <defs id='defs2'>
    //     <linearGradient id='linearGradient4035'>
    //       <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='0' id='stop4031' />
    //       <stop style={{ stopColor: '#ff3d00', stopOpacity: 1 }} offset='0.5' id='stop4039' />
    //       <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='1' id='stop4033' />
    //     </linearGradient>
    //     <linearGradient id='linearGradient4029'>
    //       <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='0' id='stop4023' />
    //       <stop style={{ stopColor: '#ff3d00', stopOpacity: 1 }} offset='0.5' id='stop4025' />
    //       <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='1' id='stop4027' />
    //     </linearGradient>
    //     <linearGradient id='linearGradient3904'>
    //       <stop style={{ stopColor: '#ff3d00', stopOpacity: 1 }} offset='0' id='stop3900' />
    //       <stop style={{ stopColor: '#ffd300', stopOpacity: 1 }} offset='0.5' id='stop3910' />
    //       <stop style={{ stopColor: '#ff3d00', stopOpacity: 1 }} offset='1' id='stop3902' />
    //     </linearGradient>
    //     <linearGradient
    //       xlinkHref='#linearGradient4029'
    //       id='linearGradient3908'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //       gradientUnits='userSpaceOnUse'
    //       spreadMethod='pad'
    //     />
    //     <linearGradient
    //       xlinkHref='#linearGradient3904'
    //       id='linearGradient3920'
    //       gradientUnits='userSpaceOnUse'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //       gradientTransform='translate(4.6780781)'
    //     />
    //     <linearGradient
    //       xlinkHref='#linearGradient3904'
    //       id='linearGradient3922'
    //       gradientUnits='userSpaceOnUse'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //       gradientTransform='translate(0,-9.1045986)'
    //     />
    //     <linearGradient
    //       xlinkHref='#linearGradient3904'
    //       id='linearGradient3924'
    //       gradientUnits='userSpaceOnUse'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //       gradientTransform='translate(-3.6756328,-0.69347901)'
    //     />
    //     <linearGradient
    //       xlinkHref='#linearGradient4035'
    //       id='linearGradient4037'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //       gradientUnits='userSpaceOnUse'
    //     />
    //     <linearGradient
    //       xlinkHref='#linearGradient4035'
    //       id='linearGradient4869'
    //       gradientUnits='userSpaceOnUse'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //       gradientTransform='translate(-4.668283,6.9455869)'
    //     />
    //     <linearGradient
    //       xlinkHref='#linearGradient4035'
    //       id='linearGradient4871'
    //       gradientUnits='userSpaceOnUse'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //       gradientTransform='translate(4.6694945,6.9455869)'
    //     />
    //     <linearGradient
    //       xlinkHref='#linearGradient4035'
    //       id='linearGradient4875'
    //       gradientUnits='userSpaceOnUse'
    //       x1='-72.710701'
    //       y1='-4.9980154e-05'
    //       x2='72.710701'
    //       y2='-4.9980154e-05'
    //     />
    //   </defs>
    //   <g id='layer1'>
    //     <g
    //       transform='matrix(2.992682,0,0,2.6978712,256,256.00013)'
    //       id='cube_icon'
    //       style={{ display: 'none', opacity: 1, fill: 'url(#linearGradient3908)', fillOpacity: 1, fillRule: 'nonzero' }}
    //       imageRendering='optimizeQuality'
    //     >
    //       <title id='title3914'>Enter</title>
    //       <path
    //         style={{
    //           fill: 'url(#linearGradient3920)',
    //           fillOpacity: 1,
    //           fillRule: 'nonzero',
    //           stroke: '#000000',
    //           strokeWidth: 4,
    //           strokeLinejoin: 'round',
    //           strokeOpacity: 1,
    //         }}
    //         d='M 75.388778,-43.3013 4.6780781,-7.94593 V 78.6566 L 75.388778,43.3013 Z'
    //         id='right'
    //       >
    //         <title id='title3918'>Enter</title>
    //       </path>
    //       <path
    //         style={{
    //           fill: 'url(#linearGradient3922)',
    //           fillOpacity: 1,
    //           fillRule: 'nonzero',
    //           stroke: '#000000',
    //           strokeWidth: 4,
    //           strokeLinejoin: 'round',
    //           strokeOpacity: 1,
    //         }}
    //         d='M 70.7107,-52.405899 0,-87.761199 -70.7107,-52.405899 0,-17.050529 Z'
    //         id='top'
    //       >
    //         <title id='title3916'>Enter</title>
    //       </path>
    //       <path
    //         style={{
    //           fill: 'url(#linearGradient3924)',
    //           fillOpacity: 1,
    //           fillRule: 'nonzero',
    //           stroke: '#000000',
    //           strokeWidth: 4,
    //           strokeLinejoin: 'round',
    //           strokeOpacity: 1,
    //         }}
    //         imageRendering='optimizeQuality'
    //         d='m -3.6756328,-8.639409 -70.7107002,-35.35537 v 86.6026 l 70.7107002,35.3553 z'
    //         id='left'
    //       />
    //     </g>
    //     <g
    //       transform='matrix(2.9981832,0,0,2.9981832,256,243.82335)'
    //       id='g3397'
    //       style={{ display: 'inline', fill: 'url(#linearGradient4037)', fillOpacity: 1 }}
    //     >
    //       <path
    //         style={{
    //           display: 'inline',
    //           fill: 'url(#linearGradient4871)',
    //           fillOpacity: 1,
    //           stroke: '#000000',
    //           strokeWidth: 4,
    //           strokeLinejoin: 'round',
    //           strokeOpacity: 1,
    //         }}
    //         d='M 75.380195,-36.355713 4.6694945,-1.0003431 V 85.602187 l 70.7107005,-35.3553 z'
    //         id='path3391'
    //       />
    //       <path
    //         style={{
    //           display: 'inline',
    //           fill: 'url(#linearGradient4875)',
    //           fillOpacity: 1,
    //           stroke: '#000000',
    //           strokeWidth: 4,
    //           strokeLinejoin: 'round',
    //           strokeOpacity: 1,
    //         }}
    //         d='M 70.7107,-43.3013 0,-78.6566 -70.7107,-43.3013 0,-7.94593 Z'
    //         id='path3393'
    //       />
    //       <path
    //         style={{
    //           display: 'inline',
    //           fill: 'url(#linearGradient4869)',
    //           fillOpacity: 1,
    //           stroke: '#000000',
    //           strokeWidth: 4,
    //           strokeLinejoin: 'round',
    //           strokeOpacity: 1,
    //         }}
    //         d='m -4.668283,-1.0003431 -70.7107,-35.3553699 v 86.6026 l 70.7107,35.3553 z'
    //         id='path3395'
    //       />
    //     </g>
    //   </g>
    // </svg>
  );
}
