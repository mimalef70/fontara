import React from "react";




export const PlusIcon = () => (
    <svg
        className="size-5"
        width="24" height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 3C16.9709 3 21 7.02908 21 12C21 16.9699 16.9709 21 12 21C7.02908 21 3 16.9699 3 12C3 7.02908 7.02908 3 12 3Z"
            stroke="#2374ff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        > </path>
        < path
            d="M15.2989 12.002H8.69922"
            stroke="#2374ff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        > </path>
        < path
            d="M12 8.70386V15.2967"
            stroke="#2374ff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        > </path>
    </svg>
);

export const Circle = () => (
    <svg className="size-5" id="Circle" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12.25 3.75098C7.69359 3.75098 4 7.44457 4 12.001C4 16.5563 7.69354 20.25 12.25 20.25C16.8065 20.25 20.5 16.5563 20.5 12.001C20.5 7.44457 16.8064 3.75098 12.25 3.75098ZM2.5 12.001C2.5 6.61614 6.86516 2.25098 12.25 2.25098C17.6348 2.25098 22 6.61614 22 12.001C22 17.3849 17.6348 21.75 12.25 21.75C6.86522 21.75 2.5 17.3849 2.5 12.001Z" fill="#000000"></path>
    </svg>
);

export const CheckedCircle = ({ className }: { className?: string }) => (
    <svg id="Check circle" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" >
        <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9699 7.02908 21 12 21C16.9709 21 21 16.9699 21 12Z" stroke="#0D92F4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M8.53516 12.0003L10.845 14.3091L15.4627 9.69141" stroke="#0D92F4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
);
